// Basic UI test for autocomplete in navigation (mount point input)
// This is a placeholder for a UI-driven test. In a real-world scenario, use a framework like Spectron, Playwright, or Selenium for Electron apps.
// Here, we provide a structure for a test using Jest and Playwright (headless browser)

const { _electron: electron } = require('playwright');

// NOTE: This test assumes you have Playwright set up and your Electron app can be launched for testing.
describe('Navigation Autocomplete Popup', () => {
  let app;
  let window;

  beforeAll(async () => {
    app = await electron.launch({
      args: ['.'] // Adjust path to your Electron main entry if needed
    });
    window = await app.firstWindow();
  });

  afterAll(async () => {
    await app.close();
  });

  it('shows autocomplete popup when typing in mount point', async () => {
    // Open the connect dialog (simulate navigation)
    await window.click('text="Connect"'); // Adjust selector as needed
    await window.fill('#txt_mount_point', '/h');
    // Wait for popup
    await window.waitForSelector('.autocomplete-popup', { timeout: 2000 });
    const popupVisible = await window.isVisible('.autocomplete-popup');
    expect(popupVisible).toBe(true);
  });

  it('selects an autocomplete suggestion with keyboard', async () => {
    await window.fill('#txt_mount_point', '/h');
    await window.waitForSelector('.autocomplete-popup', { timeout: 2000 });
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('Enter');
    // Check that the popup is gone and input is filled
    const popupExists = await window.$('.autocomplete-popup');
    expect(popupExists).toBeNull();
    const value = await window.inputValue('#txt_mount_point');
    expect(value.length).toBeGreaterThan(2); // Should be filled with a suggestion
  });
});
