const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    forbidOnly: !!process.env.CI,
    timeout: 60000,
    workers: 1,
    reporter: 'list'
});
