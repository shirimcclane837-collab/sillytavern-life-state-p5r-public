import { test, expect } from '@playwright/test';

const panel = '#life-state-continuity-panel';
const settle = page => page.evaluate(async () => {
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});
async function start(page) {
    await page.goto('/');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await settle(page);
}
async function toggle(page) {
    await page.locator(`${panel} .ls-toggle`).click();
    await settle(page);
}
async function drag(page, point, dx, dy) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 });
    await page.mouse.up();
    await settle(page);
}
async function headerPoint(page) {
    const box = await page.locator(`${panel} .ls-bar`).boundingBox();
    return { x: box.x + 6, y: box.y + box.height / 2 };
}
async function expectPosition(page, expected) {
    const actual = await page.locator(panel).boundingBox();
    expect(actual.x).toBeCloseTo(expected.x, 0);
    expect(actual.y).toBeCloseTo(expected.y, 0);
}

test.describe('desktop window dragging', () => {
    test.use({ viewport: { width: 1440, height: 1100 } });

    test('header padding and toggle whitespace both drag without collapsing, and a fresh click still closes', async ({ page }) => {
        await start(page);
        await toggle(page);
        const before = await page.locator(panel).boundingBox();
        await drag(page, await headerPoint(page), 80, 50);
        await expectPosition(page, { x: before.x + 80, y: before.y + 50 });
        await expect(page.locator(panel)).toHaveClass(/ls-open/);

        const button = await page.locator(`${panel} .ls-toggle`).boundingBox();
        await drag(page, { x: button.x + 8, y: button.y + 8 }, -40, -25);
        await expectPosition(page, { x: before.x + 40, y: before.y + 25 });
        await expect(page.locator(panel)).toHaveClass(/ls-open/);
        await page.locator(`${panel} .p5r-close`).click();
        await settle(page);
        await expect(page.locator(panel)).not.toHaveClass(/ls-open/);
    });

    test('entry and expanded window keep separate positions across closing and reloading', async ({ page }) => {
        await start(page);
        const button = await page.locator(`${panel} .ls-toggle`).boundingBox();
        await drag(page, { x: button.x + button.width / 2, y: button.y + button.height / 2 }, 100, -60);
        const entry = await page.locator(panel).boundingBox();
        await expect(page.locator(panel)).not.toHaveClass(/ls-open/);
        await toggle(page);
        await drag(page, await headerPoint(page), -70, 60);
        const expanded = await page.locator(panel).boundingBox();
        await toggle(page);
        await expectPosition(page, entry);
        await toggle(page);
        await expectPosition(page, expanded);
        await page.reload();
        await page.waitForFunction(() => window.extension?.getStatus().running);
        await settle(page);
        await expectPosition(page, entry);
        await toggle(page);
        await expectPosition(page, expanded);
    });

    test('viewport edges and a smaller browser window leave the header and navigation reachable', async ({ page }) => {
        await start(page);
        await toggle(page);
        const point = await headerPoint(page);
        await drag(page, point, -point.x, -point.y);
        await expectPosition(page, { x: 8, y: 8 });
        const next = await headerPoint(page);
        await drag(page, next, 1439 - next.x, 1099 - next.y);
        let bounds = await page.locator(panel).boundingBox();
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(1432);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(1092);
        await page.setViewportSize({ width: 900, height: 700 });
        await settle(page);
        bounds = await page.locator(panel).boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(8);
        expect(bounds.y).toBeGreaterThanOrEqual(8);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(892);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(692);
        await page.locator(`${panel} [data-action=modern-page][data-ui-page=settings]`).click();
        await expect(page.locator(panel)).toHaveAttribute('data-ui-page', 'settings');
        await expectPosition(page, bounds);
    });

    test('losing window focus ends the drag and does not leave the next gesture stuck', async ({ page }) => {
        await start(page);
        await toggle(page);
        const point = await headerPoint(page);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 60, point.y + 30, { steps: 6 });
        await expect(page.locator(panel)).toHaveClass(/ls-dragging/);
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await expect(page.locator(panel)).not.toHaveClass(/ls-dragging/);
        const stopped = await page.locator(panel).boundingBox();
        await page.mouse.move(point.x + 100, point.y + 60);
        await page.mouse.up();
        await expectPosition(page, stopped);
        await drag(page, await headerPoint(page), -30, -20);
        await expectPosition(page, { x: stopped.x - 30, y: stopped.y - 20 });
        await expect(page.locator(panel)).toHaveClass(/ls-open/);
    });
});

test('mobile entry supports native touch dragging, cancellation and restoring its saved position', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await settle(page);
    const session = await context.newCDPSession(page);
    const before = await page.locator(panel).boundingBox();
    const button = await page.locator(`${panel} .ls-toggle`).boundingBox();
    const x = button.x + button.width / 2, y = button.y + button.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 15, y: y - i * 10 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expectPosition(page, { x: before.x - 90, y: before.y - 60 });
    await expect(page.locator(panel)).not.toHaveClass(/ls-open|ls-dragging/);
    const point = await headerPoint(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 15, y: point.y - 15 }] });
    await expect(page.locator(panel)).toHaveClass(/ls-dragging/);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(page.locator(panel)).not.toHaveClass(/ls-dragging/);
    const saved = await page.locator(panel).boundingBox();
    await page.reload();
    await page.waitForFunction(() => window.extension?.getStatus().running);
    await settle(page);
    await expectPosition(page, saved);
    // Reload also starts a fresh native gesture sequence after Chromium's drag gesture.
    await page.locator(`${panel} .ls-toggle`).tap();
    await settle(page);
    await expect(page.locator(panel)).toHaveClass(/ls-open/);
    await page.locator(`${panel} .p5r-close`).tap();
    await settle(page);
    await expectPosition(page, saved);
    await context.close();
});
