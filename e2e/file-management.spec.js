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
    return page.locator(`.active-tab-content .card[data-href=${JSON.stringify(href)}]`);
}

async function navigate(location) {
    await page.keyboard.press('Control+L');
    const input = page.locator('input.location');
    await expect(input).toBeVisible();
    await input.fill(location);
    await input.press('Enter');
    await expect.poll(() => currentLocation()).toBe(location);
    await expect(page.locator('.active-tab-content .view_container')).toBeVisible();
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
    const source = path.join(fixture, '0000.png');
    await writeImage(source, 64);
    await Promise.all(Array.from({ length: 1000 }, (_, index) => fs.copyFile(source,
        path.join(fixture, `${String(index + 1).padStart(4, '0')}.png`))));
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
        await Promise.all(Array.from({ length: fillerCount }, (_, index) =>
            fs.writeFile(path.join(fixture, `filler-${index}.txt`), 'contents')));
        const source = path.join(fixture, '000-vector #1%.svg');
        await fs.writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>');
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
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>';
        const source = path.join(fixture, '0000.svg');
        await fs.writeFile(source, svg);
        for (let batch = 0; batch < 7000; batch += 200) {
            await Promise.all(Array.from({ length: Math.min(200, 7000 - batch) }, (_, index) => {
                const target = path.join(fixture, `${String(batch + index).padStart(4, '0')}.svg`);
                return target === source ? Promise.resolve() : fs.copyFile(source, target);
            }));
        }
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
    const target = path.join(fixture, 'match-directory');
    await fs.mkdir(target);
    await fs.writeFile(path.join(target, 'child.txt'), 'child');
    for (let batch = 0; batch < 7000; batch += 200) {
        await Promise.all(Array.from({ length: 200 }, (_, index) =>
            fs.writeFile(path.join(fixture, `match-${String(batch + index).padStart(4, '0')}.txt`), 'contents')));
    }
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
    const next = path.join(fixture, 'next');
    await fs.mkdir(next);
    await fs.writeFile(path.join(next, 'sentinel.txt'), 'keep');
    for (let batch = 0; batch < 4000; batch += 200) {
        await Promise.all(Array.from({ length: 200 }, (_, index) =>
            fs.writeFile(path.join(fixture, `match-${batch + index}.txt`), 'contents')));
    }
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
            for (let batch = 0; batch < count; batch += 200) {
                await Promise.all(Array.from({ length: Math.min(200, count - batch) }, (_, index) =>
                    fs.writeFile(path.join(fixture, `file-${batch + index}.txt`), 'contents')));
            }
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
