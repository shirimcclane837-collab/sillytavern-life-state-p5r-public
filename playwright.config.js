import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    workers: 2,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true,
        launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
        screenshot: 'only-on-failure',
    },
    webServer: { command: 'node scripts/preview.mjs', port: 4173, reuseExistingServer: !process.env.CI },
});
