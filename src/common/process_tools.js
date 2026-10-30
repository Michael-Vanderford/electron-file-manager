const { execFile } = require('child_process');
const path = require('path');

// Parse configured executable/arguments, without shell expansion or evaluation.
function command_args(command) {
    if (typeof command !== 'string' || command.includes('\0')) throw new Error('Invalid command.');
    const words = [];
    let word = '', quote = '', started = false;
    for (let i = 0; i < command.length; i++) {
        const c = command[i];
        if (c === '\\' && quote === '"' && !['"', '\\', '$', '`'].includes(command[i + 1])) {
            word += c; started = true;
        } else if (c === '\\' && quote !== "'") {
            if (++i === command.length) throw new Error('Incomplete command escape.');
            word += command[i]; started = true;
        } else if (quote) {
            if (c === quote) quote = ''; else word += c;
        } else if (c === '"' || c === "'") { quote = c; started = true; }
        else if (/\s/.test(c)) {
            if (started) { words.push(word); word = ''; started = false; }
        } else { word += c; started = true; }
    }
    if (quote) throw new Error('Unclosed command quote.');
    if (started) words.push(word);
    if (!words[0]) throw new Error('Missing executable.');
    return words;
}

function run_configured(command, callback) {
    try {
        const [executable, ...args] = command_args(command);
        return execFile(executable, args, callback);
    } catch (error) { callback(error); }
}

function launch_desktop(launcher, href, callback) {
    const appid = typeof launcher?.appid === 'string' ? path.basename(launcher.appid) : '';
    if (!appid || appid.includes('\0') || typeof launcher.mimetype !== 'string' || !launcher.mimetype || launcher.mimetype.includes('\0') || typeof href !== 'string' || !path.isAbsolute(href) || href.includes('\0')) {
        callback(new Error('This application has no valid desktop entry or file path.'));
        return;
    }
    // Let GTK implement Desktop Entry field codes, preserving executable/argument case.
    execFile('xdg-mime', ['default', appid, launcher.mimetype], error => {
        if (error) return callback(error);
        execFile('gtk-launch', ['--', appid, href], callback);
    });
}

module.exports = { command_args, run_configured, launch_desktop };
