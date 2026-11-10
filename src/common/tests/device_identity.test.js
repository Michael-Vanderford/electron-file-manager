const { parse_volumes, merge_devices, device_key } = require('../device_identity');
const listing = `Drive(0): disk
  Volume(0): SAME
    ids:
     unix-device: '/dev/sda1'
    can_mount=0
    Mount(0): SAME -> file:///media/SAME
Drive(1): USB
  Volume(0): SAME
    ids:
     unix-device: '/dev/sdb1'
    can_mount=1
Volume(0): Phone
  activation_root=mtp://phone/
  can_mount=1
Mount(0): network -> smb://server/share/
`;
test('GIO hierarchy retains different devices with the same label', () => {
    const volumes = parse_volumes(listing);
    expect(volumes).toEqual([
        expect.objectContaining({ name: 'SAME', device: '/dev/sda1', path: 'file:///media/SAME' }),
        expect.objectContaining({ name: 'SAME', device: '/dev/sdb1', path: '', can_mount: true }),
        expect.objectContaining({ name: 'Phone', activation_root: 'mtp://phone/', type: 'phone', path: '' })
    ]);
    expect(device_key(volumes[0])).not.toBe(device_key(volumes[1]));
});
test('merges mount aliases by path while preserving same-label mounted and unmounted volumes', () => {
    const volumes = parse_volumes(listing);
    const merged = merge_devices([{ name: 'SAME', path: '/media/SAME' }], volumes);
    expect(merged).toHaveLength(3);
    expect(merged[0].device).toBe('/dev/sda1');
    expect(merged[1].device).toBe('/dev/sdb1');
    expect(merge_devices([{ name: 'SAME', path: '/media/a' }, { name: 'SAME', path: '/media/b' }], [])).toHaveLength(2);
});


test('mounted representation wins when the other list still reports the same device as unmounted', () => {
    const mounted = { name: 'SAME', path: '/media/usb', device: '/dev/sdb1', total: 100 };
    const stale = { name: 'SAME', path: '', device: '/dev/sdb1', can_mount: true };
    const merged = merge_devices([mounted], [stale]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject(mounted);
    expect(device_key(merged[0])).toBe(device_key(stale));
});


test('collapses duplicates already in the mounts list and URI/GVFS aliases across lists', () => {
    const local = '/run/user/1000/gvfs/mtp:host=phone';
    const mount = { name: 'Phone', path: local };
    const uri = { name: 'Phone', path: 'mtp://phone/', canonical_path: local };
    expect(merge_devices([mount, { ...mount }], [uri])).toHaveLength(1);
    expect(device_key(mount)).toBe(device_key(uri));
});
test('mounted entry wins when an unmounted snapshot comes first in the mounts list', () => {
    const stale = { name: 'USB', path: '', device: '/dev/fixture' };
    const mounted = { ...stale, path: '/media/fixture' };
    expect(merge_devices([stale, mounted], [])).toEqual([mounted]);
});


test('SFTP root and default-home listings are one connection while same-label servers stay separate', () => {
    const root = '/run/user/1000/gvfs/sftp:host=fixture-one';
    const mounts = [{ name: 'Same server', path: root }];
    const drives = [
        { name: 'Same server', path: 'sftp://fixture-one/home/user', canonical_path: root + '/home/user' },
        { name: 'Same server', path: 'sftp://fixture-two/home/user', canonical_path: '/run/user/1000/gvfs/sftp:host=fixture-two/home/user' }
    ];
    const merged = merge_devices(mounts, drives);
    expect(merged).toHaveLength(2);
    expect(merged[0].path).toBe(root);
    expect(device_key(mounts[0])).toBe(device_key(drives[0]));
    expect(device_key(drives[0])).not.toBe(device_key(drives[1]));
});
