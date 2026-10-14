const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

let app;
let page;
let fixture;

test.beforeEach(async () => {
    fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-e2e-'));
    app = await electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'] });
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
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(fixture);
    await expect(page.locator('.active-tab-content')).toBeVisible();
});

test.afterEach(async () => {
    if (app) await app.close();
    if (fixture) await fs.rm(fixture, { recursive: true, force: true });
});

test('navigates into a folder and back and forward', async () => {
    const parent = path.dirname(fixture);
    await page.evaluate(() => window.titlebarAPI.up());
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(parent);
    await page.locator(`.card[data-href="${fixture}"] .href`).click();
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(fixture);
    await fs.mkdir(path.join(fixture, 'child'));
    await page.evaluate(() => window.titlebarAPI.refresh());

    await page.locator(`.active-tab-content .card[data-href="${path.join(fixture, 'child')}"] .href`).click();
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(path.join(fixture, 'child'));
    await page.keyboard.press('Alt+ArrowLeft');
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(fixture);
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(path.join(fixture, 'child'));
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
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(path.join(fixture, 'child'));

    await page.locator('.tab').first().click();
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(fixture);
    await secondTab.click();
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(path.join(fixture, 'child'));
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
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(path.join(fixture, 'destination'));
    await page.keyboard.press('Control+V');
    await expect.poll(() => fs.readFile(path.join(fixture, 'destination', 'copy.txt'), 'utf8').catch(() => '')).toBe('copy contents');

    await page.evaluate(() => window.titlebarAPI.up());
    await expect.poll(() => page.evaluate(() => window.titlebarAPI.getLocation())).toBe(fixture);
    await page.locator(`.card[data-href="${path.join(fixture, 'move.txt')}"]`).click();
    await page.keyboard.press('Control+X');
    await page.locator(`.card[data-href="${path.join(fixture, 'destination')}"] .href`).click();
    await page.keyboard.press('Control+V');
    await expect.poll(() => fs.readFile(path.join(fixture, 'destination', 'move.txt'), 'utf8').catch(() => '')).toBe('move contents');
    await expect.poll(() => fs.stat(path.join(fixture, 'move.txt')).then(() => true, () => false)).toBe(false);
});
