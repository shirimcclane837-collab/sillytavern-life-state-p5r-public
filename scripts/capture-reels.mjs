// Record the real browser interaction against the local mock host.
import { chromium } from '@playwright/test';
import { mkdir, rename } from 'node:fs/promises';

const output = new URL('../release/portrait-preview/', import.meta.url).pathname;
const screenshots = new URL('../docs/screenshots/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const panel = '#life-state-continuity-panel';
const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
try {
    for (const mobile of [false, true]) {
        const name = mobile ? 'mobile' : 'desktop';
        const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 };
        const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, recordVideo: { dir: output, size: viewport } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:4173');
        await page.waitForFunction(() => window.extension?.getStatus().running);
        await page.locator(`${panel} .ls-toggle`).click();
        await settle(page);
        const row = page.locator(`${panel} .p5r-calling-card .p5r-party-window`);
        await row.scrollIntoViewIfNeeded();
        await page.mouse.move(1, 1);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: screenshots + (mobile ? 'welcome-mobile.png' : 'welcome.png') });
        const box = await row.boundingBox();
        if (mobile) {
            const session = await context.newCDPSession(page);
            const x = box.x + box.width * .75, y = box.y + box.height / 2;
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (let step = 1; step <= 18; step++) {
                await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 9, y }] });
                await page.waitForTimeout(30);
            }
            await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
            await row.hover();
            await page.waitForTimeout(2000);
            await page.mouse.move(box.x + 320, box.y + 35);
            await page.mouse.down();
            for (let step = 1; step <= 24; step++) {
                await page.mouse.move(box.x + 320 - step * 8, box.y + 35);
                await page.waitForTimeout(25);
            }
            await page.mouse.up();
        }
        await page.mouse.move(1, 1);
        await page.waitForTimeout(3500);
        const video = page.video();
        await context.close();
        await rename(await video.path(), output + `portraits-${name}.webm`);
        if (errors.length) throw new Error(errors.join('\n'));
        console.log(`${name}: captured automatic scrolling and manual browsing`);
    }
} finally {
    await browser.close();
}
