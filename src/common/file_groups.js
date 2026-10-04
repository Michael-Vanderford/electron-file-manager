const { group_recent_files } = require('./recent_groups');

const TYPE_GROUPS = [
    'Folders',
    'Images',
    'Audio',
    'Video',
    'Documents',
    'Archives',
    'Applications',
    'Other',
];

const SIZE_GROUPS = ['Folders', 'Tiny', 'Small', 'Medium', 'Large', 'Unknown Size'];
const MIB = 1024 * 1024;

function get_type_group(file) {
    if (file?.is_dir || file?.content_type === 'inode/directory') {
        return 'Folders';
    }

    const content_type = String(file?.content_type || '').toLowerCase();
    if (content_type.startsWith('image/')) {
        return 'Images';
    }
    if (content_type.startsWith('audio/')) {
        return 'Audio';
    }
    if (content_type.startsWith('video/')) {
        return 'Video';
    }
    if (content_type.startsWith('text/') || /pdf|msword|word|document|spreadsheet|ms-excel|presentation|powerpoint|opendocument|json|xml/.test(content_type)) {
        return 'Documents';
    }
    if (/zip|tar|gzip|compressed|archive|rar/.test(content_type)) {
        return 'Archives';
    }
    if (content_type.startsWith('application/') && content_type !== 'application/octet-stream') {
        return 'Applications';
    }
    return 'Other';
}

function get_size_group(file) {
    if (file?.is_dir || file?.content_type === 'inode/directory') {
        return 'Folders';
    }

    if (file?.size === undefined || file?.size === null || file.size === '') {
        return 'Unknown Size';
    }

    const size = Number(file.size);
    if (!Number.isFinite(size) || size < 0) {
        return 'Unknown Size';
    }
    if (size < MIB) {
        return 'Tiny';
    }
    if (size < 16 * MIB) {
        return 'Small';
    }
    if (size < 128 * MIB) {
        return 'Medium';
    }
    return 'Large';
}

function group_files(files = [], group_by = 'None', now = new Date()) {
    if (group_by === 'None') {
        return null;
    }
    if (group_by === 'Date Modified') {
        return group_recent_files(files, now);
    }

    const labels = group_by === 'Type' ? TYPE_GROUPS : group_by === 'Size' ? SIZE_GROUPS : null;
    if (!labels) {
        return null;
    }

    const grouped = new Map(labels.map((label) => [label, []]));
    files.forEach((file) => {
        const label = group_by === 'Type' ? get_type_group(file) : get_size_group(file);
        grouped.get(label).push(file);
    });

    return labels
        .map((label) => ({ label, files: grouped.get(label) }))
        .filter((group) => group.files.length > 0);
}

module.exports = { group_files, get_type_group, get_size_group };