const { get_recent_group, group_recent_files } = require('../recent_groups');

describe('recent date groups', () => {
    const now = new Date(2026, 8, 30, 15, 0, 0);
    const seconds_at = (year, month, day, hour = 12) => {
        return new Date(year, month, day, hour).getTime() / 1000;
    };

    it('groups dates using local calendar days and Monday-based weeks', () => {
        expect(get_recent_group(seconds_at(2026, 8, 30), now)).toBe('Today');
        expect(get_recent_group(seconds_at(2026, 8, 29), now)).toBe('Yesterday');
        expect(get_recent_group(seconds_at(2026, 8, 28), now)).toBe('Earlier this week');
        expect(get_recent_group(seconds_at(2026, 8, 21), now)).toBe('Last week');
        expect(get_recent_group(seconds_at(2026, 8, 10), now)).toBe('Earlier this month');
        expect(get_recent_group(seconds_at(2026, 5, 10), now)).toBe('Earlier this year');
        expect(get_recent_group(seconds_at(2025, 11, 31), now)).toBe('A long time ago');
    });

    it('places invalid or missing modification dates in the oldest group', () => {
        expect(get_recent_group(undefined, now)).toBe('A long time ago');
        expect(get_recent_group('not-a-date', now)).toBe('A long time ago');
    });

    it('returns only populated groups and sorts files newest-first within each group', () => {
        const files = [
            { name: 'older today', mtime: seconds_at(2026, 8, 30, 9) },
            { name: 'yesterday', mtime: seconds_at(2026, 8, 29, 18) },
            { name: 'newer today', mtime: seconds_at(2026, 8, 30, 14) },
        ];

        expect(group_recent_files(files, now)).toEqual([
            { label: 'Today', files: [files[2], files[0]] },
            { label: 'Yesterday', files: [files[1]] },
        ]);
    });
});