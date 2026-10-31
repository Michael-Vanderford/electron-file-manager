const path = require('path');
const CONTENT_TYPE_BY_EXT = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.cjs': 'text/javascript',
    '.ts': 'text/x-typescript', '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css', '.xml': 'application/xml', '.csv': 'text/csv',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.ico': 'image/vnd.microsoft.icon',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed', '.rar': 'application/vnd.rar',
    '.exe': 'application/x-msdownload', '.sh': 'application/x-sh',
};

function get_content_type(name, is_dir) {
    return is_dir ? 'inode/directory' : CONTENT_TYPE_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function perms_from_stats(stats) {
    const uid = process.getuid?.() ?? -1;
    const groups = new Set(process.getgroups?.() || []);
    groups.add(process.getgid?.() ?? -1);
    const bits = stats.uid === uid ? (stats.mode >> 6) & 7 :
        groups.has(stats.gid) ? (stats.mode >> 3) & 7 : stats.mode & 7;
    return { is_readable: !!(bits & 4), is_writable: !!(bits & 2) };
}

module.exports = { get_content_type, perms_from_stats };
