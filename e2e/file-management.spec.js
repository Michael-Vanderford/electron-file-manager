const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let app;
let page;
let fixture;
let profile;

test.beforeEach(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-e2e-'));
    profile = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-profile-'));
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ env, args: ['.', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`] });
    await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({ response: 1 });
    });
    page = await app.firstWindow();
    await page.waitForFunction(() => window.titlebarAPI?.getLocation());
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Control+L');
    const location = page.locator('input.location');
    await expect(location).toBeVisible();
    await location.fill(fixture);
    await location.press('Enter');
    await expect.poll(() => currentLocation()).toBe(fixture);
    await expect(page.locator('.active-tab-content')).toBeVisible();
    await expect(page.locator('.footer .msg')).toHaveText('Loaded 0 items');
    await expect.poll(async () => path.resolve(await page.locator('.active-tab').getAttribute('data-href'))).toBe(fixture);
});

test.afterEach(async () => {
    if (app) await app.close();
    app = null;
    if (profile) await fs.rm(profile, { recursive: true, force: true });
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
});

test('navigates into a folder and back and forward', async () => {
    const parent = path.dirname(fixture);
    await page.evaluate(() => window.titlebarAPI.up());
    await expect.poll(() => currentLocation()).toBe(parent);
    await page.locator(`.card[data-href="${fixture}"] .href`).click();
    await expect.poll(() => currentLocation()).toBe(fixture);
    await fs.mkdir(path.join(fixture, 'child'));
    await page.evaluate(() => window.titlebarAPI.refresh());

    await page.locator(`.active-tab-content .card[data-href="${path.join(fixture, 'child')}"] .href`).click();
    await expect.poll(() => currentLocation()).toBe(path.join(fixture, 'child'));
    await page.keyboard.press('Alt+ArrowLeft');
    await expect.poll(() => currentLocation()).toBe(fixture);
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(() => currentLocation()).toBe(path.join(fixture, 'child'));
});

test('selects one, multiple, and all visible items', async () => {
    await fs.writeFile(path.join(fixture, 'alpha.txt'), 'a');
    await fs.writeFile(path.join(fixture, 'beta.txt'), 'b');
    await fs.mkdir(path.join(fixture, 'child'));
    await page.evaluate(() => window.titlebarAPI.refresh());

    const alpha = page.locator(`.card[data-href="${path.join(fixture, 'alpha.txt')}"]`);
    const beta = page.locator(`.card[data-href="${path.join(fixture, 'beta.txt')}"]`);
    await expect(alpha).toBeVisible();
    await expect(beta).toBeVisible();
    await alpha.click();
    await expect(page.locator('.active-tab-content .card.highlight_select')).toHaveCount(1);
    await beta.click({ modifiers: ['Control'] });
    await expect(page.locator('.active-tab-content .card.highlight_select')).toHaveCount(2);

    await page.keyboard.press('Control+A');
    await expect(page.locator('.active-tab-content .card.highlight_select')).toHaveCount(3);
});

test('keeps each tab at its own current folder when switching', async () => {
    await fs.mkdir(path.join(fixture, 'child'));
    await page.evaluate(() => window.titlebarAPI.refresh());
    await page.evaluate(() => window.titlebarAPI.newTab());
    await expect(page.locator('.tab')).toHaveCount(2);

    const secondTab = page.locator('.tab').nth(1);
    await page.locator(`.active-tab-content .card[data-href="${path.join(fixture, 'child')}"] .href`).click();
    await expect.poll(() => currentLocation()).toBe(path.join(fixture, 'child'));

    await page.locator('.tab').first().click();
    await expect.poll(() => currentLocation()).toBe(fixture);
    await secondTab.click();
    await expect.poll(() => currentLocation()).toBe(path.join(fixture, 'child'));
});

test('creates, renames, and deletes a folder', async () => {
    await page.keyboard.press('Control+Shift+N');
    const nameInput = page.locator('.active-tab-content .edit_name').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('created-folder');
    await nameInput.press('Enter');
    await expect.poll(() => fs.stat(path.join(fixture, 'created-folder')).then(() => true, () => false)).toBe(true);

    const folder = page.locator(`.card[data-href="${path.join(fixture, 'created-folder')}"]`);
    await folder.click();
    await page.keyboard.press('F2');
    const renameInput = folder.locator('.edit_name');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('renamed-folder');
    await renameInput.press('Enter');
    await expect.poll(() => fs.stat(path.join(fixture, 'renamed-folder')).then(() => true, () => false)).toBe(true);
    await expect.poll(() => fs.stat(path.join(fixture, 'created-folder')).then(() => true, () => false)).toBe(false);

    await page.locator(`.card[data-href="${path.join(fixture, 'renamed-folder')}"]`).click();
    await page.evaluate(() => window.titlebarAPI.delete());
    await expect.poll(() => fs.stat(path.join(fixture, 'renamed-folder')).then(() => true, () => false)).toBe(false);
});

test('copies and moves files between folders', async () => {
    await fs.mkdir(path.join(fixture, 'destination'));
    await fs.writeFile(path.join(fixture, 'copy.txt'), 'copy contents');
    await fs.writeFile(path.join(fixture, 'move.txt'), 'move contents');
    await page.evaluate(() => window.titlebarAPI.refresh());

    await page.locator(`.card[data-href="${path.join(fixture, 'copy.txt')}"]`).click();
    await page.keyboard.press('Control+C');
    await page.locator(`.card[data-href="${path.join(fixture, 'destination')}"] .href`).click();
    await expect.poll(() => currentLocation()).toBe(path.join(fixture, 'destination'));
    await page.keyboard.press('Control+V');
    await expect.poll(() => fs.readFile(path.join(fixture, 'destination', 'copy.txt'), 'utf8').catch(() => '')).toBe('copy contents');

    await page.evaluate(() => window.titlebarAPI.up());
    await expect.poll(() => currentLocation()).toBe(fixture);
    await page.locator(`.card[data-href="${path.join(fixture, 'move.txt')}"]`).click();
    await page.keyboard.press('Control+X');
    await page.locator(`.card[data-href="${path.join(fixture, 'destination')}"] .href`).click();
    await page.keyboard.press('Control+V');
    await expect.poll(() => fs.readFile(path.join(fixture, 'destination', 'move.txt'), 'utf8').catch(() => '')).toBe('move contents');
    await expect.poll(() => fs.stat(path.join(fixture, 'move.txt')).then(() => true, () => false)).toBe(false);
});

async function currentLocation() {
    return path.resolve(await page.evaluate(() => window.titlebarAPI.getLocation()));
}

function card(href) {
    const escaped = href.replace(/["\\\n\r\f]/g, character => `\\${character.codePointAt(0).toString(16)} `);
    return page.locator(`.active-tab-content .card[data-href="${escaped}"]`);
}

async function navigate(location) {
    await page.keyboard.press('Control+L');
    const input = page.locator('input.location');
    await expect(input).toBeVisible();
    await input.fill(location);
    await input.press('Enter');
    await expect.poll(() => currentLocation()).toBe(location);
    await expect(page.locator('.active-tab-content .view_container')).toBeVisible();
    await expect.poll(async () => path.resolve(await page.locator('.active-tab').getAttribute('data-href'))).toBe(path.resolve(location));
    await expect(page.locator('.footer .msg')).toHaveText(/^Loaded \d+ items$/);
}

// Bulk render/search fixtures are built outside the watched directory, then opened.
// This avoids testing native watcher storms as an accidental setup step.
async function buildOutsideView() {
    const idle = path.join(profile, 'fixture-staging');
    await fs.mkdir(idle, { recursive: true });
    await navigate(idle);
    return () => navigate(fixture);
}

async function exists(href) {
    return fs.stat(href).then(() => true, () => false);
}

for (const operation of ['copy', 'cut']) {
    for (const kind of ['file', 'folder']) {
        test(`${operation}/paste ${kind} keeps the destination card after completion and navigation`, async () => {
            const source = path.join(fixture, 'source');
            const destination = path.join(fixture, 'destination');
            await fs.mkdir(source);
            await fs.mkdir(destination);
            const name = kind === 'file' ? 'transfer.txt' : 'nested-folder';
            const original = path.join(source, name);
            const pasted = path.join(destination, name);
            const suffix = kind === 'file' ? '' : path.join('nested', 'contents.txt');
            if (kind === 'folder') await fs.mkdir(path.join(original, 'nested'), { recursive: true });
            await fs.writeFile(suffix ? path.join(original, suffix) : original, 'transfer contents');

            await navigate(source);
            await card(original).click();
            await page.keyboard.press(operation === 'copy' ? 'Control+C' : 'Control+X');
            await navigate(destination);
            await page.keyboard.press('Control+V');

            await expect.poll(() => fs.readFile(suffix ? path.join(pasted, suffix) : pasted, 'utf8').catch(() => '')).toBe('transfer contents');
            await expect.poll(() => exists(original)).toBe(operation === 'copy');
            await expect(card(pasted)).toBeVisible();
            await expect(card(pasted)).toHaveCount(1);

            // Exercise tab data by leaving and returning, then refresh from disk.
            await navigate(source);
            await expect(card(original)).toHaveCount(operation === 'copy' ? 1 : 0);
            await navigate(destination);
            await expect(card(pasted)).toBeVisible();
            await page.evaluate(() => window.titlebarAPI.refresh());
            await expect(card(pasted)).toBeVisible();
            await expect(card(pasted)).toHaveCount(1);
        });
    }
}

for (const operation of ['copy', 'cut']) {
    test(`${operation}/paste transfers multiple selected files`, async () => {
        const source = path.join(fixture, 'source');
        const destination = path.join(fixture, 'destination');
        await fs.mkdir(source);
        await fs.mkdir(destination);
        for (const name of ['alpha.txt', 'beta.txt']) await fs.writeFile(path.join(source, name), name);
        await navigate(source);
        await card(path.join(source, 'alpha.txt')).click();
        await card(path.join(source, 'beta.txt')).click({ modifiers: ['Control'] });
        await expect(page.locator('.active-tab-content .card.highlight_select')).toHaveCount(2);
        await page.keyboard.press(operation === 'copy' ? 'Control+C' : 'Control+X');
        await navigate(destination);
        await page.keyboard.press('Control+V');

        for (const name of ['alpha.txt', 'beta.txt']) {
            await expect.poll(() => fs.readFile(path.join(destination, name), 'utf8').catch(() => '')).toBe(name);
            await expect.poll(() => exists(path.join(source, name))).toBe(operation === 'copy');
            await expect(card(path.join(destination, name))).toBeVisible();
            await expect(card(path.join(destination, name))).toHaveCount(1);
        }
    });
}

test('Copy after Cut pastes the copied selection and preserves both sources', async () => {
    const source = path.join(fixture, 'source');
    const destination = path.join(fixture, 'destination');
    await fs.mkdir(source);
    await fs.mkdir(destination);
    await fs.writeFile(path.join(source, 'cut.txt'), 'cut contents');
    await fs.writeFile(path.join(source, 'copy.txt'), 'copy contents');
    await navigate(source);
    await card(path.join(source, 'cut.txt')).click();
    await page.keyboard.press('Control+X');
    await card(path.join(source, 'copy.txt')).click();
    await page.keyboard.press('Control+C');
    await navigate(destination);
    await page.keyboard.press('Control+V');

    await expect.poll(() => fs.readFile(path.join(destination, 'copy.txt'), 'utf8').catch(() => '')).toBe('copy contents');
    await expect(card(path.join(destination, 'copy.txt'))).toBeVisible();
    expect(await exists(path.join(destination, 'cut.txt'))).toBe(false);
    expect(await fs.readFile(path.join(source, 'cut.txt'), 'utf8')).toBe('cut contents');
    expect(await fs.readFile(path.join(source, 'copy.txt'), 'utf8')).toBe('copy contents');
});

async function writeImage(href, width = 2048) {
    const png = await app.evaluate(({ nativeImage }, { width }) => {
        const bitmap = Buffer.alloc(width * width * 4, 180);
        const image = nativeImage.createFromBitmap(bitmap, { width, height: width });
        return image.toPNG().toString('base64');
    }, { width });
    await fs.writeFile(href, Buffer.from(png, 'base64'));
}

async function thumbnail(href) {
    const image = card(href).locator('.icon .img').first();
    await expect(image).toHaveAttribute('src', /\/thumbnails\/[a-f0-9]+\.png$/);
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    return image;
}

test('uses small cached thumbnails and invalidates previews after edits', async () => {
    const source = path.join(fixture, 'large.png');
    await writeImage(source);
    await page.evaluate(() => window.titlebarAPI.refresh());
    const preview = await thumbnail(source);
    const first = await preview.getAttribute('src');
    expect(await preview.evaluate(img => img.naturalWidth)).toBe(256);
    const cacheFile = require('node:url').fileURLToPath(first);
    const cached = await fs.stat(cacheFile);
    await navigate(path.dirname(fixture));
    await navigate(fixture);
    expect(await (await thumbnail(source)).getAttribute('src')).toBe(first);
    expect((await fs.stat(cacheFile)).mtimeMs).toBe(cached.mtimeMs);

    await writeImage(source, 512);
    await page.evaluate(() => window.titlebarAPI.refresh());
    await expect.poll(async () => (await thumbnail(source)).getAttribute('src')).not.toBe(first);
});

test('corrupt images retain a generic icon and do not block healthy previews', async () => {
    const broken = path.join(fixture, 'broken.png');
    const healthy = path.join(fixture, 'healthy.png');
    await fs.writeFile(broken, 'not an image');
    await writeImage(healthy);
    await page.evaluate(() => window.titlebarAPI.refresh());
    await thumbnail(healthy);
    await expect(card(broken).locator('.icon .img').first()).toHaveAttribute('src', /image-generic\.svg$/);
});

test('loads thumbnails after scrolling a virtual image directory', async () => {
    const openFixture = await buildOutsideView();
    const source = path.join(fixture, '0000.png');
    await writeImage(source, 64);
    await Promise.all(Array.from({ length: 1000 }, (_, index) => fs.copyFile(source,
        path.join(fixture, `${String(index + 1).padStart(4, '0')}.png`))));
    await openFixture();
    await page.evaluate(() => window.titlebarAPI.refresh());
    await expect(page.locator('.footer .msg')).toHaveText('Loaded 1001 items');
    await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('sort_by', 'name', 'asc');
    });
    await expect(page.locator('.active-tab-content .card').first()).toBeVisible();
    const top = await page.locator('.active-tab-content .card').first().getAttribute('data-href');
    await thumbnail(top);
    await page.locator('.active-tab-content').evaluate(container => { container.scrollTop = container.scrollHeight; });
    const last = card(path.join(fixture, '1000.png'));
    await expect(last).toBeVisible();
    await thumbnail(path.join(fixture, '1000.png'));
    await expect(page.locator('.active-tab-content .card')).not.toHaveCount(1001);
});

test('navigation stays responsive while thumbnail requests are pending', async () => {
    const image = path.join(fixture, 'image.png');
    await writeImage(image);
    await Promise.all(Array.from({ length: 80 }, (_, index) => fs.copyFile(image, path.join(fixture, `image-${index}.png`))));
    const next = path.join(fixture, 'next');
    await fs.mkdir(next);
    const target = path.join(next, 'target.png');
    await writeImage(target, 512);
    await page.evaluate(() => window.titlebarAPI.refresh());
    await expect(card(image)).toBeAttached();
    await navigate(next);
    await thumbnail(target);
    await expect(page.locator('.active-tab-content .card')).toHaveCount(1);
});

for (const count of [0, 3, 1001]) {
    test(`clears the loading spinner after rendering a directory with ${count} items`, async () => {
        const directory = path.join(fixture, 'loading-check');
        await fs.mkdir(directory);
        await Promise.all(Array.from({ length: count }, (_, index) =>
            fs.writeFile(path.join(directory, `${index}.txt`), 'contents')));
        await navigate(directory);
        const message = page.locator('.footer .msg');
        await expect(message).toHaveText(`Loaded ${count} items`);
        await expect(message.locator('img[alt="loading"]')).toHaveCount(0);
    });
}

test('restores the last opened directory after restarting with the same profile', async () => {
    const directory = path.join(fixture, 'last-opened');
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, 'restored.txt'), 'persisted');
    await navigate(directory);
    await expect(card(path.join(directory, 'restored.txt'))).toBeVisible();
    await expect.poll(async () => {
        const settings = JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'));
        return path.resolve(settings.location);
    }).toBe(directory);
    await app.close();
    app = null;
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ env, args: ['.', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`] });
    page = await app.firstWindow();
    await page.waitForFunction(() => window.titlebarAPI?.getLocation());
    await expect.poll(() => currentLocation()).toBe(directory);
    await expect(card(path.join(directory, 'restored.txt'))).toBeVisible();
    await expect(page.locator('.footer .msg')).toHaveText('Loaded 1 items');
});

test('dashboard shows GVFS names and capacity and omits failed queries', async () => {
    const mount = '/run/user/1000/gvfs/smb-share:server=test,share=files';
    await app.evaluate(({ BrowserWindow, ipcMain }, mount) => {
        // Isolated simulated probe responses: no real network mount is contacted.
        ipcMain.removeHandler('get_dashboard_disk_stats');
        ipcMain.removeHandler('get_recent_files_arr');
        ipcMain.handle('get_recent_files_arr', () => []);
        ipcMain.handle('get_dashboard_disk_stats', (_event, location) => {
            BrowserWindow.getAllWindows()[0].webContents.send('mounts', [
                { name: 'Test GVFS', path: mount, type: 'network' },
                { name: 'Unavailable mount', path: '/mnt/unavailable', type: 'network' }
            ]);
            return location === mount
            ? { display_name: 'smb-share:server=test,share=files', href: mount, total: 1024, used: 256, free: 768 }
            : { error: true, message: 'Device query timed out' };
        });
        BrowserWindow.getAllWindows()[0].webContents.send('mounts', [
            { name: 'Test GVFS', path: mount, type: 'network', total: 1024, used: 256, free: 768 },
            { name: 'Unavailable mount', path: '/mnt/unavailable', type: 'network' }
        ]);
    }, mount);
    await expect(page.locator('.device_item').filter({ hasText: 'Test GVFS' })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('get_dashboard_view');
    });
    const chart = page.locator('.overview .chart-container');
    await expect(chart).toHaveCount(1);
    await expect(chart.locator('.chart-title')).toHaveText('Test GVFS');
    await expect(chart.locator('.chart-title')).toHaveAttribute('href', mount);
    await expect(chart.locator('.chart-meta')).toContainText('256 Bytes Used');
    await expect(chart.locator('.chart-meta')).toContainText('768 Bytes Free');
    await expect(chart.locator('.chart-meta span')).toHaveText(['256 Bytes Used', '768 Bytes Free']);
    await expect(chart.locator('canvas')).toBeVisible();
});

test('renders verified GVFS capacity in the device sidebar', async () => {
    // Simulate the verified worker response; no real network mounts are contacted.
    await app.evaluate(({ BrowserWindow }, devices) => {
        BrowserWindow.getAllWindows()[0].webContents.send('mounts', devices);
    }, [{ name: 'Test GVFS', path: '/run/user/1000/gvfs/smb-share:server=test,share=files',
        type: 'network', total: 1000, used: 400, free: 600 }]);
    const device = page.locator('.device_item').filter({ hasText: 'Test GVFS' });
    await expect(device).toBeVisible();
    // This test injects device data to verify rendering, independently of
    // desktop pointer interception and asynchronous native discovery.
    await device.dispatchEvent('mouseover');
    await expect(device).toHaveAttribute('title', /Total:.*Used:/s);
    await expect(device.locator('xpath=following-sibling::*[1]').locator('.device_progress')).toHaveAttribute('style', /width: 40%/);
});

for (const fillerCount of [0, 1000]) {
    test(`renders SVG previews with escaped filenames in a ${fillerCount ? 'virtual' : 'normal'} directory`, async () => {
        const openFixture = await buildOutsideView();
        await Promise.all(Array.from({ length: fillerCount }, (_, index) =>
            fs.writeFile(path.join(fixture, `filler-${index}.txt`), 'contents')));
        const source = path.join(fixture, '000-vector #1%.svg');
        await fs.writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>');
        await openFixture();
        await page.evaluate(() => window.titlebarAPI.refresh());
        await expect(page.locator('.footer .msg')).toHaveText(`Loaded ${fillerCount + 1} items`);
        await app.evaluate(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows()[0].webContents.send('sort_by', 'name', 'asc');
        });
        const image = card(source).locator('.icon .img').first();
        await expect(image).toBeVisible();
        await expect(image).toHaveAttribute('src', require('node:url').pathToFileURL(source).href);
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth === 120 && img.naturalHeight === 80)).toBe(true);
        if (fillerCount) {
            await page.locator('.active-tab-content').evaluate(container => { container.scrollTop = container.scrollHeight; });
            await expect(card(source)).toHaveCount(0);
            await page.locator('.active-tab-content').evaluate(container => { container.scrollTop = 0; });
            await expect(image).toBeVisible();
            await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth === 120)).toBe(true);
        }
    });
}

for (const view of ['grid_view', 'list_view']) {
    test(`does not continue scrolling after wheel input in a 7000-SVG ${view}`, async () => {
        const openFixture = await buildOutsideView();
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>';
        const source = path.join(fixture, '0000.svg');
        await fs.writeFile(source, svg);
        for (let batch = 0; batch < 7000; batch += 200) {
            await Promise.all(Array.from({ length: Math.min(200, 7000 - batch) }, (_, index) => {
                const target = path.join(fixture, `${String(batch + index).padStart(4, '0')}.svg`);
                return target === source ? Promise.resolve() : fs.copyFile(source, target);
            }));
        }
        await openFixture();
        await page.evaluate(view => window.titlebarAPI.setView(view), view);
        await page.evaluate(() => window.titlebarAPI.refresh());
        await expect(page.locator('.footer .msg')).toHaveText('Loaded 7000 items');
        const container = page.locator('.active-tab-content');
        await container.hover();
        for (let step = 0; step < 5; step++) {
            const before = await container.evaluate(element => element.scrollTop);
            await page.mouse.wheel(0, 600);
            await expect.poll(() => container.evaluate(element => element.scrollTop)).toBeGreaterThan(before);
            const positions = await container.evaluate(async element => {
                const positions = [];
                // Sample actual animation frames after input has ended: virtual row
                // replacement must not feed browser scroll anchoring indefinitely.
                for (let frame = 0; frame < 40; frame++) {
                    await new Promise(requestAnimationFrame);
                    positions.push(element.scrollTop);
                }
                return positions.slice(15);
            });
            expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
            expect(positions.at(-1) - before).toBeLessThanOrEqual(650);
        }
    });
}

test('hot-plug updates device entries without rebuilding unchanged sidebar controls', async () => {
    const sendDevices = async (mounts, drives) => app.evaluate(({ BrowserWindow }, { mounts, drives }) => {
        const contents = BrowserWindow.getAllWindows()[0].webContents;
        contents.send('mounts', mounts);
        contents.send('devices', drives);
    }, { mounts, drives });
    const existing = { name: 'Existing test mount', path: '/mnt/existing-test', type: 'drive' };
    await sendDevices([existing], []);
    const oldDevice = page.locator('.device_item').filter({ hasText: existing.name });
    await expect(oldDevice).toBeVisible();
    const oldNode = await oldDevice.elementHandle();
    const connect = await page.locator('.connect_network').elementHandle();
    const sidebar = await page.locator('.sidebar').elementHandle();
    const usb = { name: 'New test USB', path: '', device: '/dev/test-usb', type: 'drive' };
    await sendDevices([existing], [usb]);
    const newDevice = page.locator('.device_item').filter({ hasText: usb.name });
    await expect(newDevice).toBeVisible();
    expect(await oldNode.evaluate(node => node.isConnected)).toBe(true);
    expect(await connect.evaluate(node => node.isConnected)).toBe(true);
    expect(await sidebar.evaluate(node => node.isConnected)).toBe(true);
    // Automount replaces the unmounted entry rather than duplicating it.
    await sendDevices([existing, { ...usb, path: '/media/test-usb' }], [usb]);
    await expect(newDevice).toHaveCount(1);
    await expect(newDevice.locator('a')).toHaveAttribute('href', '/media/test-usb');
    await sendDevices([existing], []);
    await expect(newDevice).toHaveCount(0);
    expect(await oldNode.evaluate(node => node.isConnected)).toBe(true);
});

async function runSearch(query) {
    if (!await page.locator('.active-tab-content .find_input').count()) await page.evaluate(() => window.titlebarAPI.find());
    const input = page.locator('.active-tab-content .find_input');
    await input.fill(query);
    await input.press('Enter');
}

test('large search results stay virtual and opening a result directory stays responsive', async () => {
    const openFixture = await buildOutsideView();
    const target = path.join(fixture, 'match-directory');
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'child.txt'), 'child');
    for (let batch = 0; batch < 7000; batch += 200) {
        await Promise.all(Array.from({ length: 200 }, (_, index) =>
            fs.writeFile(path.join(fixture, `match-${String(batch + index).padStart(4, '0')}.txt`), 'contents')));
    }
    await openFixture();
    await runSearch('match');
    await expect(page.locator('.active-tab-content .find_results_header')).toHaveText('7001 results in search location.', { timeout: 20000 });
    const results = page.locator('.active-tab-content .find_results_list');
    await expect(results.locator('.virtual_view')).toBeVisible();
    expect(await results.locator('.card').count()).toBeLessThan(250);
    await page.locator('.find_results_window').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(page.locator('.find_results_list .card').first()).toBeVisible();
    await page.locator('.find_results_window').evaluate(element => { element.scrollTop = 0; });
    await expect(card(target)).toBeVisible();
    await card(target).locator('.href').click();
    await expect.poll(() => currentLocation()).toBe(target);
    await expect(card(path.join(target, 'child.txt'))).toBeVisible();
});

test('closing and reopening search does not mix results or leave the folder unusable', async () => {
    await fs.writeFile(path.join(fixture, 'alpha.txt'), 'a');
    await fs.writeFile(path.join(fixture, 'beta.txt'), 'b');
    await page.evaluate(() => window.titlebarAPI.refresh());
    await runSearch('alpha');
    await expect(page.locator('.find_results_header')).toHaveText('1 result in search location.');
    await page.locator('.find_close').click();
    await expect(page.locator('.find_panel')).toHaveCount(0);
    await expect(card(path.join(fixture, 'beta.txt'))).toBeVisible();
    await runSearch('beta');
    await expect(page.locator('.find_results_header')).toHaveText('1 result in search location.');
    await expect(page.locator('.find_results_list .card')).toHaveCount(1);
    await expect(card(path.join(fixture, 'beta.txt'))).toBeVisible();
    await runSearch('no-such-match');
    await expect(page.locator('.find_empty')).toHaveText('No matches found.');
});

test('navigation cancels a busy search and later results cannot replace the new directory', async () => {
    const openFixture = await buildOutsideView();
    const next = path.join(fixture, 'next');
    await fs.mkdir(next);
    await fs.writeFile(path.join(next, 'sentinel.txt'), 'keep');
    for (let batch = 0; batch < 4000; batch += 200) {
        await Promise.all(Array.from({ length: 200 }, (_, index) =>
            fs.writeFile(path.join(fixture, `match-${batch + index}.txt`), 'contents')));
    }
    await openFixture();
    await runSearch('match');
    await navigate(next);
    await expect(card(path.join(next, 'sentinel.txt'))).toBeVisible();
    await expect(page.locator('.active-tab-content .find_results_list')).toHaveCount(0);
    await runSearch('sentinel');
    await expect(page.locator('.active-tab-content .find_results_header')).toHaveText('1 result in search location.');
    await expect(page.locator('.active-tab-content .find_results_list .card')).toHaveCount(1);
});

test('search panels in separate tabs keep their own results', async () => {
    await fs.writeFile(path.join(fixture, 'alpha.txt'), 'a');
    await fs.writeFile(path.join(fixture, 'beta.txt'), 'b');
    await runSearch('alpha');
    await expect(page.locator('.active-tab-content .find_results_header')).toHaveText('1 result in search location.');
    await page.evaluate(() => window.titlebarAPI.newTab());
    await expect(page.locator('.tab')).toHaveCount(2);
    await runSearch('beta');
    await expect(page.locator('.active-tab-content .find_results_header')).toHaveText('1 result in search location.');
    await expect(card(path.join(fixture, 'beta.txt'))).toBeVisible();
    await page.locator('.tab').first().click();
    await expect(page.locator('.active-tab-content .find_results_list .card')).toHaveCount(1);
    await expect(card(path.join(fixture, 'alpha.txt'))).toBeVisible();
});

test('search retains size validation, grouping, and copy actions', async () => {
    const target = path.join(fixture, 'destination');
    await fs.mkdir(target);
    await fs.writeFile(path.join(fixture, 'match-small.txt'), 'a');
    await fs.writeFile(path.join(fixture, 'match-large.txt'), 'large contents');
    await page.evaluate(() => window.titlebarAPI.find());
    await page.locator('.find_filters_toggle').click();
    await page.locator('.find_input').fill('match');
    await page.locator('input[placeholder="Min size (bytes)"]').fill('20');
    await page.locator('input[placeholder="Max size (bytes)"]').fill('5');
    await page.locator('.find_submit').click();
    await expect(page.locator('.find_results_header')).toHaveText('Min size cannot be greater than max size.');
    await page.locator('input[placeholder="Min size (bytes)"]').fill('5');
    await page.locator('input[placeholder="Max size (bytes)"]').fill('20');
    await page.locator('.find_submit').click();
    await expect(page.locator('.find_results_header')).toHaveText('1 result in search location.');
    await page.evaluate(() => window.titlebarAPI.setGroupBy('Type'));
    await expect(page.locator('.find_results_list .recent_date_group')).toHaveCount(1);
    const match = card(path.join(fixture, 'match-large.txt'));
    await match.click();
    await page.keyboard.press('Control+C');
    await navigate(target);
    await page.keyboard.press('Control+V');
    await expect.poll(() => fs.readFile(path.join(target, 'match-large.txt'), 'utf8').catch(() => '')).toBe('large contents');
    await expect(card(path.join(target, 'match-large.txt'))).toBeVisible();
});

const searchOptionCases = [
    { name: 'blank size/date options use the default depth', expected: ['zero', 'small', 'boundary', 'large', 'child'] },
    { name: 'minimum size includes the boundary', min: '10', expected: ['boundary', 'large', 'child'] },
    { name: 'maximum size includes the boundary', max: '5', expected: ['zero', 'small'] },
    { name: 'equal size bounds match exact sizes', min: '10', max: '10', expected: ['boundary', 'child'] },
    { name: 'zero maximum size matches empty files', max: '0', expected: ['zero'] },
    { name: 'modified-from includes the boundary', from: '2026-01-15T12:00', expected: ['boundary', 'large', 'child'] },
    { name: 'modified-to includes the boundary', to: '2026-01-15T12:00', expected: ['zero', 'small', 'boundary', 'child'] },
    { name: 'equal date bounds match exact timestamps', from: '2026-01-15T12:00', to: '2026-01-15T12:00', expected: ['boundary', 'child'] },
    { name: 'depth two includes grandchildren but excludes deeper files', depth: '2', expected: ['zero', 'small', 'boundary', 'large', 'child', 'deep'] },
    { name: 'depth three includes the next level', depth: '3', expected: ['zero', 'small', 'boundary', 'large', 'child', 'deep', 'far'] },
    { name: 'blank depth allows unrestricted recursion', depth: '', expected: ['zero', 'small', 'boundary', 'large', 'child', 'deep', 'far'] },
    { name: 'size date and depth filters combine', min: '10', max: '10', from: '2026-01-15T12:00', to: '2026-01-15T12:00', depth: '2', expected: ['boundary', 'child', 'deep'] },
    { name: 'nonmatching size range returns no results', min: '100', expected: [] },
    { name: 'clearing a size option removes the previous filter', min: '100', clear: true, expected: ['zero', 'small', 'boundary', 'large', 'child'] },
    { name: 'inverted size range is rejected', min: '20', max: '5', error: 'Min size cannot be greater than max size.' },
    { name: 'inverted date range is rejected', from: '2026-01-20T12:00', to: '2026-01-10T12:00', error: 'Date From cannot be later than Date To.' }
];

for (const option of searchOptionCases) {
    test(`search options: ${option.name}`, async () => {
        const files = [
            ['zero', '', 0, '2026-01-01T12:00'],
            ['small', '', 5, '2026-01-10T12:00'],
            ['boundary', '', 10, '2026-01-15T12:00'],
            ['large', '', 20, '2026-01-20T12:00'],
            ['child', 'nested', 10, '2026-01-15T12:00'],
            ['deep', 'nested/child', 10, '2026-01-15T12:00'],
            ['far', 'nested/child/deeper', 10, '2026-01-15T12:00']
        ];
        for (const [name, directory, size, date] of files) {
            const parent = path.join(fixture, directory);
            await fs.mkdir(parent, { recursive: true });
            const file = path.join(parent, `match-${name}.txt`);
            await fs.writeFile(file, Buffer.alloc(size, 65));
            // Match datetime-local interpretation in Chromium, independent of host timezone.
            const timestamp = await page.evaluate(value => new Date(value).getTime() / 1000, date);
            await fs.utimes(file, timestamp, timestamp);
        }
        await fs.writeFile(path.join(fixture, 'unrelated.txt'), 'not a name match');
        await page.evaluate(() => window.titlebarAPI.find());
        await page.locator('.find_filters_toggle').click();
        await page.locator('.find_input').fill('MATCH-');
        if (option.min !== undefined) await page.locator('input[placeholder="Min size (bytes)"]').fill(option.min);
        if (option.max !== undefined) await page.locator('input[placeholder="Max size (bytes)"]').fill(option.max);
        if (option.from !== undefined) await page.locator('input[placeholder="Modified after"]').fill(option.from);
        if (option.to !== undefined) await page.locator('input[placeholder="Modified before"]').fill(option.to);
        if (option.depth !== undefined) await page.locator('input[placeholder="Max Search Depth"]').fill(option.depth);
        await page.locator('.find_submit').click();
        if (option.error) {
            await expect(page.locator('.find_results_header')).toHaveText(option.error);
            await expect(page.locator('.find_submit')).toBeEnabled();
            return;
        }
        if (option.clear) {
            await expect(page.locator('.find_results_header')).toHaveText('0 results in search location.');
            await page.locator('input[placeholder="Min size (bytes)"]').fill('');
            await page.locator('.find_submit').click();
        }
        const count = option.expected.length;
        await expect(page.locator('.find_results_header')).toHaveText(`${count} result${count === 1 ? '' : 's'} in search location.`);
        await expect(page.locator('.find_results_list .card')).toHaveCount(count);
        const actual = await page.locator('.find_results_list .card').evaluateAll(cards =>
            cards.map(card => card.dataset.name).sort());
        expect(actual).toEqual(option.expected.map(name => `match-${name}.txt`).sort());
        if (!count) await expect(page.locator('.find_empty')).toHaveText('No matches found.');
    });
}

for (const view of ['grid_view', 'list_view']) {
    for (const count of [3, 1001]) {
        test(`loads ${count} files in ${view} without selecting the first card and keeps arrow navigation`, async () => {
            const openFixture = await buildOutsideView();
            for (let batch = 0; batch < count; batch += 200) {
                await Promise.all(Array.from({ length: Math.min(200, count - batch) }, (_, index) =>
                    fs.writeFile(path.join(fixture, `file-${batch + index}.txt`), 'contents')));
            }
            await openFixture();
            await page.evaluate(view => window.titlebarAPI.setView(view), view);
            await page.evaluate(() => window.titlebarAPI.refresh());
            await expect(page.locator('.footer .msg')).toHaveText(`Loaded ${count} items`);
            const selected = page.locator('.active-tab-content .card.highlight_select');
            await expect(selected).toHaveCount(0);
            const container = page.locator('.active-tab-content .view_container');
            await container.focus();
            await page.keyboard.press('ArrowDown');
            await expect(selected).toHaveCount(1);
            await expect(container.locator('.card').first()).toHaveClass(/highlight_select/);
            await page.keyboard.press('ArrowRight');
            await expect(selected).toHaveCount(1);
            await expect(container.locator('.card').first()).not.toHaveClass(/highlight_select/);
        });
    }
}

test('empty Workspace stays above Devices and accepts the first dragged item', async () => {
    const source = path.join(fixture, 'workspace-source.txt');
    await fs.writeFile(source, 'workspace contents');
    await page.evaluate(() => window.titlebarAPI.refresh());
    const workspace = page.locator('.sidebar .workspace_view');
    const empty = workspace.locator('.workspace_empty');
    await expect(empty).toHaveText('Drop a file or folder');
    await expect(workspace.locator('#workspace')).toHaveCount(1);
    const aboveDevices = () => workspace.evaluate(element => {
        const devices = document.querySelector('.device_view');
        return !!(element.compareDocumentPosition(devices) & Node.DOCUMENT_POSITION_FOLLOWING)
            && element.getBoundingClientRect().bottom <= devices.getBoundingClientRect().top;
    });
    expect(await aboveDevices()).toBe(true);
    await card(source).click();
    const origin = await card(source).boundingBox();
    const target = await empty.boundingBox();
    await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(workspace.locator('.workspace_item')).toHaveCount(1);
    await expect(empty).toHaveCount(0);
    expect(await fs.readFile(source, 'utf8')).toBe('workspace contents');
    expect(await aboveDevices()).toBe(true);
    await page.reload();
    await expect(workspace.locator('.workspace_item')).toHaveCount(1);
    expect(await aboveDevices()).toBe(true);
    // Exercise the existing remove-workspace command, scoped to the test profile.
    await app.evaluate(({ BrowserWindow }, href) => {
        BrowserWindow.getAllWindows()[0].webContents.send('remove_workspace', href);
    }, source);
    await expect(empty).toBeVisible();
    await expect(workspace.locator('.workspace_item')).toHaveCount(0);
    expect(await aboveDevices()).toBe(true);
});

for (const view of ['grid_view', 'list_view']) {
    for (const grouping of ['None', 'Type']) {
        test(`empty folder message follows create delete and rebuild in ${view} grouped by ${grouping}`, async () => {
            await page.evaluate(({ view, grouping }) => {
                window.titlebarAPI.setView(view);
                window.titlebarAPI.setGroupBy(grouping);
            }, { view, grouping });
            const message = page.locator('.active-tab-content > .empty_msg');
            await expect(message).toHaveCount(1);
            await expect(message).toHaveText('Folder is Empty');
            // A paste with an empty clipboard must leave the empty state intact.
            await page.keyboard.press('Control+V');
            await expect(message).toHaveCount(1);
            await page.evaluate(() => window.titlebarAPI.refresh());
            await expect(page.locator('.footer .msg')).toHaveText('Loaded 0 items');
            await expect(message).toHaveCount(1);
            await page.keyboard.press('Control+Shift+N');
            const input = page.locator('.active-tab-content .edit_name').first();
            await expect(input).toBeVisible();
            await expect(message).toHaveCount(0);
            await input.fill('created');
            await input.press('Enter');
            const folder = card(path.join(fixture, 'created'));
            await expect(folder).toBeVisible();
            await folder.click();
            await page.evaluate(() => window.titlebarAPI.delete());
            await expect(folder).toHaveCount(0);
            await expect(message).toHaveCount(1);
            await expect(message).toHaveText('Folder is Empty');
            await page.evaluate(() => window.titlebarAPI.setGroupBy('Size'));
            await expect(message).toHaveCount(1);
        });
    }
}

for (const count of [3, 1001]) {
    test(`filter empty state clears when matches return with ${count} files`, async () => {
        const openFixture = await buildOutsideView();
        await Promise.all(Array.from({ length: count }, (_, index) =>
            fs.writeFile(path.join(fixture, `file-${index}.txt`), 'contents')));
        await openFixture();
        await page.evaluate(() => window.titlebarAPI.refresh());
        await expect(page.locator('.footer .msg')).toHaveText(`Loaded ${count} items`);
        const message = page.locator('.active-tab-content > .empty_msg');
        const filter = page.locator('.filter');
        await filter.fill('zzzz-no-match');
        await expect(message).toHaveText('No matching items');
        await filter.fill('file-0');
        await expect(message).toHaveCount(0);
        await filter.fill('');
        await expect(message).toHaveCount(0);
        await expect(card(path.join(fixture, 'file-0.txt'))).toBeVisible();
    });
}

test('Recent empty messaging follows population removal view changes and navigation', async () => {
    const openFixture = await buildOutsideView();
    const source = path.join(fixture, 'recent.txt');
    await fs.writeFile(source, 'recent');
    await openFixture();
    await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0].webContents.send('recent_files', [], true);
    });
    const message = page.locator('.active-tab-content > .empty_msg');
    await expect(message).toHaveText('No recent files');
    await page.evaluate(() => window.titlebarAPI.setView('list_view'));
    await expect(message).toHaveCount(1);
    await expect(message).toHaveText('No recent files');
    await app.evaluate(({ BrowserWindow }, source) => {
        BrowserWindow.getAllWindows()[0].webContents.send('recent_files', [{
            href: source, location: source.slice(0, source.lastIndexOf('/')),
            id: Buffer.from(source).toString('base64'), name: 'recent.txt', display_name: 'recent.txt',
            is_dir: false, is_hidden: false, is_readable: true, is_writable: true,
            content_type: 'text/plain', size: 6, mtime: Date.now() / 1000
        }], false);
    }, source);
    await expect(card(source)).toBeVisible();
    await expect(message).toHaveCount(0);
    // Simulate the existing remove response; preserve the actual fixture file.
    await app.evaluate(({ BrowserWindow }, source) => {
        BrowserWindow.getAllWindows()[0].webContents.send('remove_items', [{ href: source }]);
    }, source);
    await expect(message).toHaveText('No recent files');
    await page.locator('.tab').first().click();
    await navigate(fixture);
    await expect(message).toHaveCount(0);
    await expect(card(source)).toBeVisible();
    await page.locator('.tab').filter({ hasText: 'Recent' }).click();
    await expect(message).toHaveText('No recent files');
});

for (const grouping of ['None', 'Type']) {
    test(`hidden-only folder messaging follows visibility toggles grouped by ${grouping}`, async () => {
        const source = path.join(fixture, '.hidden.txt');
        await fs.writeFile(source, 'hidden');
        const hide = page.locator('button[title="Hide Hidden Files"]');
        if (await hide.count()) await hide.click();
        await page.evaluate(grouping => window.titlebarAPI.setGroupBy(grouping), grouping);
        await page.evaluate(() => window.titlebarAPI.refresh());
        await expect(page.locator('.footer .msg')).toHaveText('Loaded 1 items');
        const message = page.locator('.active-tab-content > .empty_msg');
        await expect(message).toHaveText('No visible items');
        await page.locator('button[title="Show Hidden Files"]').click();
        await expect(card(source)).toBeVisible();
        await expect(message).toHaveCount(0);
        await page.locator('button[title="Hide Hidden Files"]').click();
        await expect(card(source)).not.toBeVisible();
        await expect(message).toHaveText('No visible items');
        await page.locator('.filter').fill('hidden');
        await expect(card(source)).not.toBeVisible();
        await expect(message).toHaveText('No matching items');
        await page.locator('.filter').fill('');
        await expect(card(source)).not.toBeVisible();
        await expect(message).toHaveText('No visible items');
    });
}

test('watcher response additions and removals update the empty folder message without refresh', async () => {
    const message = page.locator('.active-tab-content > .empty_msg');
    await expect(message).toHaveText('Folder is Empty');
    const source = path.join(fixture, 'external.txt');
    await fs.writeFile(source, 'external');
    // Exercise the renderer's watcher-response path without relying on native watch support.
    await app.evaluate(({ BrowserWindow }, source) => {
        BrowserWindow.getAllWindows()[0].webContents.send('get_item', {
            href: source, location: source.slice(0, source.lastIndexOf('/')),
            id: Buffer.from(source).toString('base64'), name: 'external.txt', display_name: 'external.txt',
            is_dir: false, is_hidden: false, is_readable: true, is_writable: true,
            content_type: 'text/plain', size: 8, mtime: Date.now() / 1000
        });
    }, source);
    await expect(card(source)).toBeVisible();
    await expect(message).toHaveCount(0);
    await fs.rm(source);
    await app.evaluate(({ BrowserWindow }, source) => {
        BrowserWindow.getAllWindows()[0].webContents.send('remove_item', Buffer.from(source).toString('base64'));
    }, source);
    await expect(card(source)).toHaveCount(0);
    await expect(message).toHaveCount(1);
    await expect(message).toHaveText('Folder is Empty');
});

for (const operation of ['copy', 'cut']) {
    test(`P0 ${operation} and delete a directory symlink without changing its target`, async () => {
        const target = path.join(fixture, 'target'); const destination = path.join(fixture, 'destination');
        await fs.mkdir(target); await fs.mkdir(destination);
        await fs.writeFile(path.join(target, 'precious.txt'), 'preserve target');
        const source = path.join(fixture, 'link'); const pasted = path.join(destination, 'link');
        await fs.symlink(target, source);
        await page.evaluate(() => window.titlebarAPI.refresh());
        await card(source).click();
        await page.keyboard.press(operation === 'copy' ? 'Control+C' : 'Control+X');
        await navigate(destination); await page.keyboard.press('Control+V');
        await expect.poll(() => fs.readlink(pasted).catch(() => '')).toBe(target);
        await expect(card(pasted)).toBeVisible();
        await card(pasted).click(); await page.evaluate(() => window.titlebarAPI.delete());
        await expect.poll(() => fs.lstat(pasted).then(() => true, () => false)).toBe(false);
        await expect(card(pasted)).toHaveCount(0);
        expect(await fs.readFile(path.join(target, 'precious.txt'), 'utf8')).toBe('preserve target');
        expect(await fs.lstat(source).then(() => true, () => false)).toBe(operation === 'copy');
    });
}

for (const operation of ['copy', 'cut']) {
    for (const kind of ['file', 'folder']) {
        test(`P0 ${operation} overwrite ${kind} replaces only after completion`, async () => {
            const from = path.join(fixture, 'from'); const to = path.join(fixture, 'to');
            await fs.mkdir(from); await fs.mkdir(to);
            const source = path.join(from, 'item'); const destination = path.join(to, 'item');
            if (kind === 'folder') {
                await fs.mkdir(source); await fs.mkdir(destination);
                await fs.writeFile(path.join(source, 'new.txt'), 'new contents');
                await fs.writeFile(path.join(destination, 'old.txt'), 'old contents');
            } else { await fs.writeFile(source, 'new contents'); await fs.writeFile(destination, 'old contents'); }
            await navigate(from); await card(source).click();
            await page.keyboard.press(operation === 'copy' ? 'Control+C' : 'Control+X');
            await navigate(to); await page.keyboard.press('Control+V');
            await expect(page.locator('.overwrite_view')).toBeVisible();
            expect(await fs.readFile(kind === 'folder' ? path.join(destination, 'old.txt') : destination, 'utf8')).toBe('old contents');
            await page.locator('.overwrite_view').getByText('Overwrite', { exact: true }).click();
            await expect.poll(() => fs.readFile(kind === 'folder' ? path.join(destination, 'new.txt') : destination, 'utf8').catch(() => '')).toBe('new contents');
            await expect.poll(() => exists(source)).toBe(operation === 'copy');
            if (kind === 'folder') expect(await exists(path.join(destination, 'old.txt'))).toBe(false);
            await navigate(to); await expect(card(destination)).toBeVisible();
        });
    }
}

test('P0 failed overwrite and keep or skip preserve original destinations', async () => {
    const from = path.join(fixture, 'from'); const to = path.join(fixture, 'to');
    await fs.mkdir(from); await fs.mkdir(to);
    for (const name of ['keep.txt', 'fail.txt', 'skip.txt', 'new.txt']) await fs.writeFile(path.join(from, name), `new ${name}`);
    for (const name of ['keep.txt', 'fail.txt', 'skip.txt']) await fs.writeFile(path.join(to, name), `original ${name}`);
    await navigate(from); await page.keyboard.press('Control+A'); await page.keyboard.press('Control+C');
    await navigate(to); await page.keyboard.press('Control+V');
    await expect(page.locator('.overwrite_view')).toBeVisible();
    await expect.poll(() => fs.readFile(path.join(to, 'new.txt'), 'utf8').catch(() => '')).toBe('new new.txt');
    // Row identity is the name cell's exact title, which also documents source/destination.
    const nameCell = name => page.locator('.overwrite_view div[title]').filter({ hasText: new RegExp(`^${name.replace('.', '\\.')}$$`) }).first();
    await nameCell('keep.txt').locator('..').getByText('Keep', { exact: true }).click();
    await fs.rm(path.join(from, 'fail.txt'));
    await nameCell('fail.txt').locator('..').getByText('Overwrite', { exact: true }).click();
    await expect(page.locator('.footer .msg')).toContainText('Copy incomplete');
    expect(await fs.readFile(path.join(to, 'fail.txt'), 'utf8')).toBe('original fail.txt');
    await page.locator('.overwrite_view').getByText('Skip All', { exact: true }).click();
    expect(await fs.readFile(path.join(to, 'keep.txt'), 'utf8')).toBe('original keep.txt');
    expect(await fs.readFile(path.join(to, 'skip.txt'), 'utf8')).toBe('original skip.txt');
});

test('P0 cancelling an overwrite leaves the original and move source intact', async () => {
    const from = path.join(fixture, 'from'); const to = path.join(fixture, 'to');
    await fs.mkdir(from); await fs.mkdir(to);
    const source = path.join(from, 'large.bin'); const destination = path.join(to, 'large.bin');
    const handle = await fs.open(source, 'w'); await handle.truncate(128 * 1024 * 1024); await handle.close();
    await fs.writeFile(destination, 'original');
    await navigate(from); await card(source).click(); await page.keyboard.press('Control+X');
    await navigate(to); await page.keyboard.press('Control+V');
    await page.locator('.overwrite_view').getByText('Overwrite', { exact: true }).click();
    await expect(page.locator('.progress_cancel')).toBeVisible();
    await page.locator('.progress_cancel').click();
    await expect(page.locator('.footer .msg')).toContainText('Move cancelled');
    expect(await fs.readFile(destination, 'utf8')).toBe('original');
    expect((await fs.stat(source)).size).toBe(128 * 1024 * 1024);
});

test('P0 archive creation offers conflicts and never truncates a selected archive', async () => {
    const source = path.join(fixture, 'report.txt'); const archive = path.join(fixture, 'report.zip');
    await fs.writeFile(source, 'archive input'); await fs.writeFile(archive, 'original archive');
    await page.evaluate(() => window.titlebarAPI.refresh());
    await card(source).click(); await page.locator('button[title="Compress to zip"]').click();
    await expect(page.locator('.overwrite_view')).toBeVisible();
    expect(await fs.readFile(archive, 'utf8')).toBe('original archive');
    await page.locator('.overwrite_view').getByText('Keep', { exact: true }).click();
    expect(await fs.readFile(archive, 'utf8')).toBe('original archive');
    await navigate(fixture); await card(source).click(); await page.locator('button[title="Compress to zip"]').click();
    await page.locator('.overwrite_view').getByText('Overwrite All', { exact: true }).click();
    await expect.poll(async () => (await fs.readFile(archive)).subarray(0, 2).toString()).toBe('PK');
    await expect(page.locator('.footer .msg')).toHaveText('Done compressing files.');
    expect(await fs.readFile(source, 'utf8')).toBe('archive input');
    const before = await fs.readFile(archive);
    await navigate(fixture); await card(archive).click(); await page.locator('button[title="Compress to zip"]').click();
    await expect(page.locator('.footer .msg')).toContainText('same entry');
    expect(await fs.readFile(archive)).toEqual(before);
});

test('P0 startup restores a destination interrupted after its backup rename', async () => {
    const source = path.join(fixture, 'source.txt'); const destination = path.join(fixture, 'destination.txt');
    await fs.writeFile(source, 'new contents'); await fs.writeFile(destination, 'original');
    await app.close(); app = null;
    const script = `
        const fs = require('fs/promises'); const rename = fs.rename.bind(fs);
        fs.rename = async (from, to) => { await rename(from, to); if (to.endsWith('/original')) process.exit(23); };
        require(${JSON.stringify(path.resolve('src/common/safe_replace.js'))}).transfer(
            ${JSON.stringify(source)}, ${JSON.stringify(destination)},
            ${JSON.stringify({ overwrite: true, journal_dir: path.join(profile, 'replacement-journals') })}
        ).catch(() => process.exit(1));
    `;
    const child = require('node:child_process').spawnSync(process.execPath, ['-e', script]);
    expect(child.status).toBe(23); expect(await exists(destination)).toBe(false);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await electron.launch({ env, args: ['.', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`] });
    page = await app.firstWindow(); await page.waitForFunction(() => window.titlebarAPI?.getLocation());
    expect(await fs.readFile(destination, 'utf8')).toBe('original');
    expect(await fs.readFile(source, 'utf8')).toBe('new contents');
    expect(await fs.readdir(path.join(profile, 'replacement-journals'))).toEqual([]);
});

test('P0 symlink transfers remain safe in a grouped virtual list', async () => {
    const openFixture = await buildOutsideView();
    const target = path.join(fixture, 'target'); const destination = path.join(fixture, 'destination');
    await fs.mkdir(target); await fs.mkdir(destination);
    await fs.writeFile(path.join(target, 'precious.txt'), 'target bytes');
    await Promise.all(Array.from({ length: 1001 }, (_, index) => fs.writeFile(path.join(fixture, `f-${index}.txt`), 'filler')));
    const source = path.join(fixture, '000-link'); await fs.symlink(target, source);
    await openFixture();
    await page.evaluate(() => { window.titlebarAPI.setView('list_view'); window.titlebarAPI.setGroupBy('Type'); window.titlebarAPI.refresh(); });
    await expect(page.locator('.active-tab-content .virtual_view')).toBeVisible();
    await expect(page.locator('.footer .msg')).toHaveText('Loaded 1004 items');
    // Target the row itself: a pointer click on its link opens it. Keyboard virtual
    // selection has a separate model-sync defect (TODO R31), outside transfer safety.
    await card(source).dispatchEvent('click');
    await expect(card(source)).toHaveClass(/highlight_select/);
    await page.evaluate(() => window.titlebarAPI.copy());
    await expect(page.locator('.footer .msg')).toContainText('Copied 1 items');
    await navigate(destination); await page.keyboard.press('Control+V');
    const pasted = path.join(destination, '000-link');
    await expect.poll(() => fs.readlink(pasted).catch(() => '')).toBe(target);
    await expect(card(pasted)).toBeVisible();
    await card(pasted).dispatchEvent('click');
    await page.evaluate(() => window.titlebarAPI.delete());
    await expect.poll(() => fs.lstat(pasted).then(() => true, () => false)).toBe(false);
    expect(await fs.readFile(path.join(target, 'precious.txt'), 'utf8')).toBe('target bytes');
});

test('P0 cancelling archive overwrite preserves the original archive', async () => {
    const source = path.join(fixture, 'large.bin'); const destination = path.join(fixture, 'large.zip');
    const handle = await fs.open(source, 'w'); await handle.truncate(128 * 1024 * 1024); await handle.close();
    await fs.writeFile(destination, 'original archive');
    await page.evaluate(() => window.titlebarAPI.refresh()); await card(source).click();
    await page.locator('button[title="Compress to zip"]').click();
    await page.locator('.overwrite_view').getByText('Overwrite', { exact: true }).click();
    await expect(page.locator('.progress_cancel')).toBeVisible(); await page.locator('.progress_cancel').click();
    await expect(page.locator('.footer .msg')).toContainText(/cancel|abort/i);
    await expect(page.locator('.progress_cancel')).not.toBeVisible();
    expect(await fs.readFile(destination, 'utf8')).toBe('original archive');
    expect((await fs.stat(source)).size).toBe(128 * 1024 * 1024);
});

test('Help keyboard shortcuts matches About and closes with keyboard focus restored', async () => {
    const help = page.locator('.menu-item').filter({ has: page.locator('[data-action="about"]') });
    await help.focus(); await page.keyboard.press('Enter');
    const item = page.locator('[data-action="keyboard-shortcuts"]');
    await item.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Keyboard Shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('tr').filter({ hasText: 'Ctrl+Shift+N' })).toContainText('New folder');
    await expect(dialog.locator('tr').filter({ hasText: 'F5' })).toContainText('Refresh folder');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.locator('.shortcuts-list')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Control+Shift+N');
    await expect(page.locator('.active-tab-content .edit_name:not(.hidden)')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(help).toBeFocused();
    expect(await fs.readdir(fixture)).toEqual([]);
    await help.click(); await item.click();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toBeVisible();
    await help.click(); await page.locator('[data-action="about"]').click();
    const about = page.getByRole('dialog', { name: 'About', exact: true });
    await expect(about).toBeVisible();
    await expect(about.locator('#about-app-version')).toContainText('Version');
    await about.getByRole('button', { name: 'Close' }).click();
    await expect(about).not.toBeVisible();
});

test('Security metadata and status render literally in grid list workspace breadcrumbs and properties', async () => {
    const openFixture = await buildOutsideView();
    const payload = '<img src=x onerror="document.body.dataset.injected=1">';
    const name = `${payload}.txt`; const folderName = `folder-${payload}`;
    const source = path.join(fixture, name); const folder = path.join(fixture, folderName);
    await fs.writeFile(source, 'literal metadata'); await fs.mkdir(folder); await openFixture();
    for (const view of ['grid_view', 'list_view']) {
        await page.evaluate(view => window.titlebarAPI.setView(view), view);
        await expect(card(source).locator('.href')).toHaveText(name);
        await expect(card(source).locator('img[onerror]')).toHaveCount(0);
    }
    await page.locator('.active-tab-content .view_container').focus();
    await page.keyboard.press('Control+A');
    await page.evaluate(() => window.titlebarAPI.command('add_workspace'));
    await expect(page.locator('.workspace_item').filter({ hasText: name }).first()).toBeVisible();
    await expect(page.locator('.workspace_item img[onerror]')).toHaveCount(0);
    await page.locator('.active-tab-content').click({ position: { x: 500, y: 300 } });
    await navigate(folder);
    await expect(page.locator('.breadcrumbs')).toContainText(folderName);
    await page.evaluate(() => window.titlebarAPI.command('properties'));
    await expect(page.locator('.active-tab-content')).toContainText(folderName);
    await app.evaluate(({ BrowserWindow }, payload) => {
        const contents = BrowserWindow.getAllWindows()[0].webContents;
        contents.send('set_msg', payload);
        contents.send('set_progress', { operation: 'copy', max: 100, value: 10, status: payload });
    }, payload);
    await expect(page.locator('.footer .msg')).toHaveText(payload);
    await expect(page.locator('.progress_status')).toContainText(payload);
    await expect(page.locator('img[onerror]')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.dataset.injected)).toBeUndefined();
});

test('Security renderer has no Node access and blocks navigation popups and permissions', async () => {
    const state = await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]; const prefs = window.webContents.getLastWebPreferences();
        return { nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, sandbox: prefs.sandbox, webSecurity: prefs.webSecurity };
    });
    expect(state).toEqual({ nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true });
    expect(await page.evaluate(() => ({ require: typeof require, process: typeof process, rawIpc: typeof window.titlebarAPI.ipcRenderer })))
        .toEqual({ require: 'undefined', process: 'undefined', rawIpc: 'undefined' });
    expect(await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(() => resolve('allowed'), error => resolve(error.code))))).toBe(1);
    expect(await page.evaluate(() => window.open('https://example.invalid/'))).toBeNull();
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /script-src 'self';/);
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).not.toContain("script-src 'self' 'unsafe-inline'");
    const original = page.url();
    const target = require('node:url').pathToFileURL(path.join(fixture, 'untrusted.html')).href;
    await fs.writeFile(path.join(fixture, 'untrusted.html'), '<!doctype html><title>Blocked page</title>');
    await page.evaluate(() => {
        window.securityNavigations = [];
        window.navigation.addEventListener('navigate', event => window.securityNavigations.push({ url: event.destination.url, blocked: event.defaultPrevented }));
    });
    for (const url of [target, 'about:blank']) {
        await page.evaluate(url => { window.location.href = url; }, url);
        await expect.poll(() => page.evaluate(() => window.securityNavigations)).toContainEqual({ url, blocked: true });
        await expect(page).toHaveURL(original);
        expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getURL())).toBe(original);
    }
});

test('Security external and email links use the system opener without creating renderer windows', async () => {
    await app.evaluate(({ shell }) => {
        globalThis.openedSecurityLinks = [];
        shell.openExternal = async url => { globalThis.openedSecurityLinks.push(url); };
    });
    const help = page.locator('.menu-item').filter({ has: page.locator('[data-action="about"]') });
    await help.click(); await page.locator('[data-action="about"]').click();
    await page.getByRole('dialog', { name: 'About', exact: true }).getByRole('link', { name: 'Project Homepage' }).click();
    await expect.poll(() => app.evaluate(() => globalThis.openedSecurityLinks)).toContain('https://github.com/michael-vanderford/sfm');
    await page.getByRole('dialog', { name: 'About', exact: true }).getByRole('button', { name: 'Close' }).click();
    await page.evaluate(() => {
        const link = document.createElement('a'); link.id = 'security-mail'; link.href = 'mailto:test@example.invalid'; link.textContent = 'Email test';
        link.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:10'; document.body.append(link);
    });
    await page.locator('#security-mail').click();
    await expect.poll(() => app.evaluate(() => globalThis.openedSecurityLinks)).toContain('mailto:test@example.invalid');
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
});

test('Security connect dialog stays sandboxed and renders server errors as literal text', async () => {
    const payload = '<img src=x onerror="document.body.dataset.injected=1">';
    await app.evaluate(({ ipcMain }, payload) => {
        // Simulated service failure: no real network connection or credentials are used.
        ipcMain.removeHandler('connect');
        ipcMain.handle('connect', async (_event, settings) => { globalThis.securityConnection = settings; return { error: true, msg: payload }; });
    }, payload);
    const opening = app.waitForEvent('window');
    await page.evaluate(() => window.titlebarAPI.command('connect'));
    const dialog = await opening;
    await dialog.locator('#connection_type').selectOption('smb');
    await dialog.locator('#txt_server').fill('test-server');
    await dialog.locator('#txt_mount_point').fill(path.join(fixture, 'mount'));
    await dialog.locator('#txt_username').fill('test-user'); await dialog.locator('#txt_password').fill('not-a-real-secret');
    await dialog.locator('#button_connect').click();
    await expect(dialog.locator('.msg_connect')).toHaveText(payload);
    await expect(dialog.locator('img[onerror]')).toHaveCount(0);
    expect(await dialog.evaluate(() => ({ require: typeof require, process: typeof process, injected: document.body.dataset.injected })))
        .toEqual({ require: 'undefined', process: 'undefined', injected: undefined });
    const sandboxed = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/dialogs/connect.html')).webContents.getLastWebPreferences().sandbox);
    expect(sandboxed).toBe(true);
    await dialog.locator('#button_close').click();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
});

test('Security extraction treats quotes dollars backticks newlines and leading hyphens as literal paths', async () => {
    const openFixture = await buildOutsideView();
    const source = path.join(fixture, 'entry.txt'); await fs.writeFile(source, 'archive contents');
    const archiveName = '-archive\'$(touch SECURITY_MARKER)`touch SECOND_MARKER`\n.zip';
    const archive = path.join(fixture, archiveName);
    await require('../src/common/create_archive').create_archive({ files_arr: [{ href: source, is_dir: false }], location: fixture, type: 'zip', destination: archive },
        { journal_dir: path.join(profile, 'test-archive-journals') });
    await openFixture(); await card(archive).dispatchEvent('click');
    await page.evaluate(() => window.titlebarAPI.command('extract'));
    const output = path.join(fixture, archiveName.slice(0, -4), 'entry.txt');
    await expect.poll(() => fs.readFile(output, 'utf8').catch(() => '')).toBe('archive contents');
    expect(await fs.readFile(source, 'utf8')).toBe('archive contents');
    expect(await exists(path.join(fixture, 'SECURITY_MARKER'))).toBe(false);
    expect(await exists(path.join(fixture, 'SECOND_MARKER'))).toBe(false);
    await expect(page.locator('.footer .msg')).toHaveText('Done extracting files.');
});

test('Security IPC rejects an untrusted file page even with an unsandboxed test preload', async () => {
    const marker = path.join(fixture, 'must-not-be-created');
    const attacker = path.join(profile, 'untrusted.html'); const preload = path.join(profile, 'untrusted-preload.js');
    await fs.writeFile(attacker, '<!doctype html><title>Untrusted test page</title>');
    await fs.writeFile(preload, `
        const { ipcRenderer } = require('electron');
        window.addEventListener('DOMContentLoaded', async () => {
            const settings = ipcRenderer.sendSync('get_settings');
            ipcRenderer.send('mkdir', ${JSON.stringify(marker)});
            const result = await ipcRenderer.invoke('get_workspace').then(() => 'allowed', () => 'denied');
            ipcRenderer.send('security_test_result', { settings, result });
        });
    `);
    const result = await app.evaluate(async ({ BrowserWindow, ipcMain }, { attacker, preload }) => {
        const attackerWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: false, nodeIntegration: false, contextIsolation: true, preload } });
        try {
            const response = new Promise(resolve => ipcMain.once('security_test_result', (_event, data) => resolve(data)));
            await attackerWindow.loadFile(attacker);
            return await response;
        } finally { attackerWindow.destroy(); }
    }, { attacker, preload });
    expect(result).toEqual({ settings: null, result: 'denied' });
    expect(await exists(marker)).toBe(false);
});

test('Security legacy columns dialog uses its bundled sandbox preload and persists a column change', async () => {
    const opening = app.waitForEvent('window');
    await app.evaluate(({ BrowserWindow, Menu, ipcMain }) => {
        // Invoke the actual native menu callback; no new renderer API is added for this legacy dialog.
        const popup = Menu.prototype.popup;
        Menu.prototype.popup = function () { this.items.find(item => item.label === 'Columns').click(); };
        try {
            const contents = BrowserWindow.getAllWindows()[0].webContents;
            ipcMain.emit('columns_menu', { sender: contents, senderFrame: contents.mainFrame });
        } finally { Menu.prototype.popup = popup; }
    });
    const dialog = await opening;
    await expect(dialog.locator('#name')).toBeChecked(); await expect(dialog.locator('#name')).toBeDisabled();
    const before = await dialog.locator('#ctime').isChecked(); await dialog.locator('#ctime').setChecked(!before);
    await expect.poll(async () => {
        const settings = JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8'));
        return settings.schema.properties['List View Columns'].properties.ctime.default;
    }).toBe(!before);
    expect(await dialog.evaluate(() => ({ require: typeof require, process: typeof process }))).toEqual({ require: 'undefined', process: 'undefined' });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().endsWith('/dialogs/columns.html')).webContents.getLastWebPreferences().sandbox)).toBe(true);
    await dialog.close();
});
