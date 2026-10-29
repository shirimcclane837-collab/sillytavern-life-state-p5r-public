// Record actual interaction with the local mock host; no model requests.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'release', 'motion-preview');
const screenshots = path.join(root, 'docs', 'screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const panel = '#life-state-continuity-panel';
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));

try {
    for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
        const context = await browser.newContext({ viewport, recordVideo: { dir: output, size: viewport } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const shot = async filename => {
            await settle(page);
            if (filename) await page.screenshot({ path: path.join(screenshots, filename + '.png') });
            await page.waitForTimeout(650);
        };
        const navigate = async (destination, filename) => {
            await page.locator(`${panel} [data-action=modern-page][data-ui-page=${destination}]`).click();
            await shot(filename);
        };
        await page.goto('http://127.0.0.1:4173');
        await page.waitForFunction(() => window.extension?.getStatus().running);
        await page.locator(`${panel} .ls-toggle`).click();
        await shot(name === 'desktop' ? 'welcome' : null);
        await page.evaluate(() => window.fixture.chat('chat-b', { sample: true }));
        await shot(name === 'desktop' ? 'status' : 'mobile');
        await navigate('people', name === 'desktop' ? 'people' : null);
        await page.locator('[data-action=prepare-character-profile]').click();
        await page.locator('.p5r-editor-title').scrollIntoViewIfNeeded();
        await shot(name === 'desktop' ? 'character-editor' : 'mobile-editor');
        await navigate('play', name === 'desktop' ? 'play' : null);
        await page.locator('[data-action=play-library-page][data-play-page=restraint]').click();
        await shot();
        await page.locator('[data-action=select-restraint-entry][data-entry-id=custom]').click();
        await shot(name === 'desktop' ? 'play-editor' : null);
        await page.locator('[data-action=play-library-page][data-play-page=home]').click();
        await shot();
        await navigate('settings', name === 'desktop' ? 'settings' : null);
        await navigate('status');
        await page.keyboard.press('Escape');
        await shot();
        await page.locator(`${panel} .ls-toggle`).click();
        await shot();
        const video = page.video();
        await context.close();
        await rename(await video.path(), path.join(output, `motion-${name}.webm`));
        if (errors.length) throw new Error(errors.join('\n'));
        console.log(`${name}: recorded opening, navigation, detail, return and closing`);
    }
} finally {
    await browser.close();
}
