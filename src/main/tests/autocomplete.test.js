import { test, expect } from '@playwright/test';
import { _electron } from 'playwright';

test.describe('Navigation Autocomplete Popup', () => {
  let app;
  let window;

  test.beforeAll(async () => {
    app = await _electron.launch({ args: ['.'] });
    window = await app.firstWindow();
  });

  test.afterAll(async () => {
    // await app.close(); // Commented out to keep the window open for inspection
  });

//   test('shows autocomplete popup when typing in mount point', async () => {
//     await window.click('text="Connect"');
//     await window.fill('#txt_mount_point', '/h');
//     await expect(window.locator('.autocomplete-popup')).toBeVisible({ timeout: 2000 });
//   });

  test.only('selects an autocomplete suggestion with keyboard', async () => {
    await window.click('.breadcrumbs');
    // Clear the location input after clicking breadcrumbs
    await window.fill('.location', '');
    await window.keyboard.type('/home/michael/Down');
    await expect(window.locator('.autocomplete-popup')).toBeVisible({ timeout: 2000 });
    await window.keyboard.press('ArrowDown');
    // await window.keyboard.press('Enter');
    await expect(window.locator('.autocomplete-popup')).toBeHidden();
    await expect(window.inputValue('.location')).toHaveLengthGreaterThan(2);
    // await new Promise(() => {})
  });

});
