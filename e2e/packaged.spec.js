const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test('packaged launch core files decoder icons dialogs and shutdown', async () => {
    test.skip(!process.env.EFM_PACKAGED_EXECUTABLE, 'Set EFM_PACKAGED_EXECUTABLE to a built application on the target OS.');
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'efm-packaged-'));
    let app;
    try {
        const fixture = path.join(root, 'files'); const destination = path.join(fixture, 'destination');
        await fs.mkdir(destination, { recursive: true });
        const source = path.join(fixture, 'source.txt'); await fs.writeFile(source, 'packaged bytes');
        const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
        // Prove optional desktop tools are not prerequisites for Linux startup.
        if (process.platform === 'linux') { env.PATH = path.join(root, 'empty-bin'); await fs.mkdir(env.PATH); }
        app = await electron.launch({ executablePath: process.env.EFM_PACKAGED_EXECUTABLE, env,
            args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${path.join(root, 'profile')}`] });
        await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); });
        const page = await app.firstWindow(); await page.waitForFunction(() => window.titlebarAPI?.getLocation());
        const card = href => page.locator('.active-tab-content .card').filter({ has: page.locator(`a[href="${href.replace(/\\/g, '\\\\')}"]`) });
        const navigate = async location => {
            await page.locator('body').click({ position: { x: 10, y: 10 } });
            await page.keyboard.press('Control+L'); await page.locator('input.location').fill(location);
            await page.locator('input.location').press('Enter');
            await expect(page.locator('.footer .msg')).toHaveText(/^Loaded \d+ items$/);
            await expect.poll(async () => path.resolve(await page.evaluate(() => window.titlebarAPI.getLocation()))).toBe(path.resolve(location));
        };
        expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
        await navigate(fixture);
        await expect(card(destination).locator('.icon img.img')).toHaveAttribute('src', /folder|data:image/);
        const png = await app.evaluate(({ nativeImage }) => nativeImage.createFromBitmap(Buffer.alloc(64 * 64 * 4, 180), { width: 64, height: 64 }).toPNG().toString('base64'));
        const image = path.join(fixture, 'image.png'); await fs.writeFile(image, Buffer.from(png, 'base64'));
        await page.evaluate(() => window.titlebarAPI.refresh());
        await expect(card(image).locator('.icon img.img')).toHaveAttribute('src', /\/thumbnails\/[a-f0-9]+\.png$/);
        await app.evaluate(async ({ app }, { source, fixture }) => {
            const path = process.mainModule.require('path');
            const { create_archive } = process.mainModule.require(path.join(app.getAppPath(), 'src/common/create_archive.js'));
            await create_archive({ files_arr: [{ href: source, is_dir: false }], location: fixture, type: 'zip', destination: path.join(fixture, 'packaged.zip') },
                { journal_dir: path.join(app.getPath('userData'), 'replacement-journals') });
        }, { source, fixture });
        expect((await fs.readFile(path.join(fixture, 'packaged.zip'))).subarray(0, 2).toString()).toBe('PK');
        await card(source).dispatchEvent('click'); await page.evaluate(() => window.titlebarAPI.copy());
        await navigate(destination); await page.evaluate(() => window.titlebarAPI.paste());
        const copied = path.join(destination, 'source.txt'); await expect(card(copied)).toBeVisible();
        expect(await fs.readFile(copied, 'utf8')).toBe('packaged bytes');
        await card(copied).dispatchEvent('click'); await page.evaluate(() => window.titlebarAPI.rename());
        await card(copied).locator('.edit_name').fill('renamed.txt'); await card(copied).locator('.edit_name').press('Enter');
        const renamed = path.join(destination, 'renamed.txt'); await expect(card(renamed)).toBeVisible();
        await card(renamed).dispatchEvent('click'); await page.evaluate(() => window.titlebarAPI.delete());
        await expect(card(renamed)).toHaveCount(0); expect(await fs.readFile(source, 'utf8')).toBe('packaged bytes');
        const help = page.locator('.menu-item').filter({ has: page.locator('[data-action="about"]') });
        await help.click(); await page.locator('[data-action="about"]').click();
        await expect(page.getByRole('dialog', { name: 'About', exact: true })).toBeVisible();
        await page.getByRole('dialog', { name: 'About', exact: true }).getByRole('button', { name: 'Close' }).click();
        await app.close(); app = null;
    } finally { if (app) await app.close(); await fs.rm(root, { recursive: true, force: true }); }
});
