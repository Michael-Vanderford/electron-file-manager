const { DeleteWorker } = require('../delete_worker.js');

function createDirent(name, href, is_dir, is_symlink = false) {
    return {
        name,
        href,
        is_dir,
        is_symlink
    };
}

function buildMockGio(tree, options = {}) {
    const delayMs = options.delayMs || 0;
    return {
        get_file: jest.fn((targetPath) => {
            return {
                href: targetPath,
                name: targetPath.split('/').filter(Boolean).pop() || targetPath,
                is_dir: true,
                is_symlink: false
            };
        }),
        ls: jest.fn((targetPath, callback) => {
            const entries = tree[targetPath];
            const invoke = () => {
                if (entries instanceof Error) {
                    callback(entries);
                    return;
                }
                callback(null, entries || []);
            };

            if (delayMs > 0) {
                setTimeout(invoke, delayMs);
            } else {
                invoke();
            }
        }),
        rm: jest.fn(() => true)
    };
}

describe('DeleteWorker.count_files SMB timing', () => {
    let worker;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('counts files recursively on SMB-like paths', async () => {
        const smbRoot = '//server/share/project';

        const gioMock = buildMockGio({
            [smbRoot]: [
                createDirent('dirA', `${smbRoot}/dirA`, true),
                createDirent('file1.txt', `${smbRoot}/file1.txt`, false),
                createDirent('link-to-dir', `${smbRoot}/link-to-dir`, true, true)
            ],
            [`${smbRoot}/dirA`]: [
                createDirent('nested.txt', `${smbRoot}/dirA/nested.txt`, false),
                createDirent('dirB', `${smbRoot}/dirA/dirB`, true)
            ],
            [`${smbRoot}/dirA/dirB`]: [
                createDirent('deep.txt', `${smbRoot}/dirA/dirB/deep.txt`, false)
            ]
        });

        worker = new DeleteWorker({ gio: gioMock, parentPort: { postMessage: jest.fn() } });

        const count = await worker.count_files(smbRoot, true);

        expect(count).toBe(4);
        expect(gioMock.ls).toHaveBeenCalledTimes(3);
    });

    it('captures pre-delete latency when SMB directory listing is slow', async () => {
        const smbRoot = '//server/share/slow';
        const perReadDelayMs = 35;

        const gioMock = buildMockGio({
            [smbRoot]: [
                createDirent('folder1', `${smbRoot}/folder1`, true),
                createDirent('top.txt', `${smbRoot}/top.txt`, false)
            ],
            [`${smbRoot}/folder1`]: [
                createDirent('folder2', `${smbRoot}/folder1/folder2`, true),
                createDirent('f1.txt', `${smbRoot}/folder1/f1.txt`, false)
            ],
            [`${smbRoot}/folder1/folder2`]: [
                createDirent('f2.txt', `${smbRoot}/folder1/folder2/f2.txt`, false)
            ]
        }, { delayMs: perReadDelayMs });

        worker = new DeleteWorker({ gio: gioMock, parentPort: { postMessage: jest.fn() } });

        const startedAt = Date.now();
        const count = await worker.count_files(smbRoot, true);
        const elapsedMs = Date.now() - startedAt;

        // 3 ls calls x ~35ms each in this tree.
        expect(count).toBe(3);
        expect(elapsedMs).toBeGreaterThanOrEqual(90);
    });

    it('returns 0 when SMB listing fails before delete starts', async () => {
        const gioMock = buildMockGio({
            '//server/share/offline': new Error('EHOSTDOWN')
        });

        worker = new DeleteWorker({ gio: gioMock, parentPort: { postMessage: jest.fn() } });

        const count = await worker.count_files('//server/share/offline', true);

        expect(count).toBe(0);
    });

    it('uses gio.rm for deleting entries from a directory plan', async () => {
        const root = '//server/share/delete-me';
        const gioMock = buildMockGio({
            [root]: [
                createDirent('folder', `${root}/folder`, true),
                createDirent('top.txt', `${root}/top.txt`, false)
            ],
            [`${root}/folder`]: [
                createDirent('inner.txt', `${root}/folder/inner.txt`, false)
            ]
        });

        worker = new DeleteWorker({ gio: gioMock, parentPort: { postMessage: jest.fn() } });
        const plan = await worker.get_delete_plan({ href: root, is_dir: true });

        for (const entry of plan) {
            await worker.delete_path(entry.href, entry.is_dir, entry.name);
        }

        expect(gioMock.rm).toHaveBeenCalled();
        expect(gioMock.rm.mock.calls.length).toBe(plan.length);
    });

    it('reuses scan plan during run to avoid duplicate SMB listings', async () => {
        const root = '//server/share/reuse-plan';
        const parentPortMock = { postMessage: jest.fn() };

        const gioMock = buildMockGio({
            [root]: [
                createDirent('folder', `${root}/folder`, true),
                createDirent('top.txt', `${root}/top.txt`, false)
            ],
            [`${root}/folder`]: [
                createDirent('inner.txt', `${root}/folder/inner.txt`, false)
            ]
        });

        worker = new DeleteWorker({ gio: gioMock, parentPort: parentPortMock });

        await worker.run([
            {
                href: root,
                is_dir: true
            }
        ]);

        // root + folder should be listed once each during scan and then reused for delete.
        expect(gioMock.ls).toHaveBeenCalledTimes(2);
        expect(gioMock.rm).toHaveBeenCalledTimes(4);
        expect(parentPortMock.postMessage).toHaveBeenCalledWith(expect.objectContaining({
            cmd: 'delete_done',
            failed_items: 0,
            cancelled: false
        }));
    });
});
