const GROUPS = [
    'Today',
    'Yesterday',
    'Earlier this week',
    'Last week',
    'Earlier this month',
    'Earlier this year',
    'A long time ago',
];

function start_of_day(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function start_of_week(date) {
    const day_offset = (date.getDay() + 6) % 7;
    const start = start_of_day(date);
    start.setDate(start.getDate() - day_offset);
    return start;
}

function get_recent_group(mtime, now = new Date()) {
    const timestamp = Number(mtime) * 1000;
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return 'A long time ago';
    }

    const modified = new Date(timestamp);
    const today = start_of_day(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (modified >= today && modified < tomorrow) {
        return 'Today';
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (modified >= yesterday && modified < today) {
        return 'Yesterday';
    }

    const this_week = start_of_week(now);
    if (modified >= this_week && modified < yesterday) {
        return 'Earlier this week';
    }

    const last_week = new Date(this_week);
    last_week.setDate(last_week.getDate() - 7);
    if (modified >= last_week && modified < this_week) {
        return 'Last week';
    }

    const this_month = new Date(now.getFullYear(), now.getMonth(), 1);
    if (modified >= this_month && modified < last_week) {
        return 'Earlier this month';
    }

    const this_year = new Date(now.getFullYear(), 0, 1);
    if (modified >= this_year && modified < this_month) {
        return 'Earlier this year';
    }

    return 'A long time ago';
}

function group_recent_files(files = [], now = new Date()) {
    const grouped = new Map(GROUPS.map((label) => [label, []]));

    files.forEach((file, index) => {
        const label = get_recent_group(file?.mtime, now);
        grouped.get(label).push({ file, index });
    });

    return GROUPS
        .map((label) => ({
            label,
            files: grouped.get(label)
                .sort((a, b) => {
                    const a_mtime = Number(a.file?.mtime) || 0;
                    const b_mtime = Number(b.file?.mtime) || 0;
                    return b_mtime - a_mtime || a.index - b.index;
                })
                .map((entry) => entry.file),
        }))
        .filter((group) => group.files.length > 0);
}

module.exports = { get_recent_group, group_recent_files };